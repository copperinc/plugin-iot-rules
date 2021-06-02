let { updater } = require('@architect/utils');
const { prompt } = require('enquirer');
const { join } = require('path');
let update = updater('IoT Rules', {});

module.exports = {
    functions: function ioTRulesLambdas ({ arc, inventory }) {
        if (!arc.rules) return [];
        const cwd = inventory.inv._project.src;
        return arc.rules.map((rule) => {
            let rulesSrc = join(cwd, 'src', 'rules', rule[0]);
            return {
                src: rulesSrc,
                body: `exports.handler = async function (event) {
  console.log(event);
};`
            };
        });
    },
    package: function iotRulesPackage ({ arc, cloudformation: cfn, createFunction, /* stage = 'staging',*/ inventory }) {
        if (!arc.rules) return cfn;
        const cwd = inventory.inv._project.src;
        // modify main role to allow lambdas to publish to iot topics
        cfn.Resources.Role.Properties.Policies.push({
            PolicyName: 'ArcIoTDataPolicy',
            PolicyDocument: {
                Statement: [ {
                    Effect: 'Allow',
                    Action: [
                        'iot:Connect',
                        'iot:Publish'
                    ],
                    Resource: '*'
                } ]
            }
        });
        arc.rules.forEach(rule => {
            let ruleName = rule.shift();
            let code = join(cwd, 'src', 'rules', ruleName);
            let query = rule.join(' ').trim();
            let [ functionName, functionDefn ] = createFunction({ inventory, src: code });
            functionDefn.Properties.Events[`${functionName}PluginEvent`] = {
                Type: 'IoTRule',
                Properties: {
                    AwsIotSqlVersion: '2016-03-23',
                    Sql: query
                }
            };
            cfn.Resources[functionName] = functionDefn;
        });
        return cfn;
    },
    sandbox: {
        start: function IoTRulesServiceStart ({ arc, inventory, invokeFunction /* , services */ }, callback) {
            let rules = module.exports.functions({ arc, inventory }).map(rule => rule.src);
            if (rules && rules.length) {
                // Attach the key listener only once because this plugin's
                // sandbox hook requires interactive user input, and if the user
                // type's another 'i' key, it would trigger the listener again.
                // So listen to the event once, then at the end of the listener,
                // re-attach itself once again.
                process.stdin.once('readable', listener(rules, inventory, invokeFunction));
                update.status(`IoT Rules Sandbox Service Started, registered ${rules.length} rule(s); press "i" to trigger a rule.`);
            }
            callback();
        },
        end: function IoTRulesServiceEnd (/* { arc, inventory, services }*/ _,  callback) {
            callback();
        }
    }
};

function listener (rules, inventory, invokeFunction) {
    const cwd = inventory.inv._project.src;
    return async function IoTRulesKeyListener () {
        let input = String(process.stdin.read());
        if (input === 'i') {
            const response = await prompt([ {
                type: 'select',
                name: 'rule',
                message: 'Which IoT Rule do you want to trigger an event for?',
                choices: rules
            }, {
                type: 'input',
                name: 'payload',
                message: 'Type out the JSON payload you want to deliver to the rule (must be valid JSON!):',
                initial: '{}',
                validate: function (i) {
                    try {
                        JSON.parse(i);
                    }
                    catch (e) {
                        return e.message;
                    }
                    return true;
                },
                result: function (i) {
                    return JSON.parse(i);
                }
            } ]);
            // Workaround for enquirer to play nice with other stdin readers
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
                process.stdin.resume();
            }
            invokeFunction({ src: response.rule, payload: response.payload }, function (err) {
                if (err) {
                    update.error(`Error invoking ${response.rule.replace(cwd, '')}!`);
                    update.error(err);
                }
            });
        }
        // Re-attach the iot-rules key listener after the lambda is dispatched
        process.stdin.once('readable', listener(rules, inventory, invokeFunction));
    };
}
