let createLambdaJSON = require('@architect/package/createLambdaJSON');
let invokeLambda = require('@architect/sandbox/invokeLambda');
const { prompt } = require('enquirer');
const { join } = require('path');

module.exports = {
    package: function macroIotRules ({ arc, cloudformation: cfn, /* stage = 'staging',*/ inventory }) {
        if (arc.rules) {
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
                let [ functionName, functionDefn ] = createLambdaJSON({ inventory, src: code });
                functionDefn.Properties.Events[`${functionName}PluginEvent`] = {
                    Type: 'IoTRule',
                    Properties: {
                        AwsIotSqlVersion: '2016-03-23',
                        Sql: query
                    }
                };
                cfn.Resources[functionName] = functionDefn;
            });
        }
        return cfn;
    },
    pluginFunctions: function IoTRulesCreate ({ arc, inventory }) {
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
    sandbox: {
        start: function IoTRulesServiceStart ({ arc, inventory /* , services */ }, callback) {
            let rules = module.exports.pluginFunctions({ arc, inventory }).map(rule => rule.src);
            if (rules && rules.length) {
                process.stdin.once('readable', listener(rules, inventory));
                console.log(`IoT Rules Sandbox Service Started, registered ${rules.length} rule(s); press "i" to trigger a rule.`);
            }
            callback();
        },
        end: function IoTRulesServiceEnd (/* { arc, inventory, services }*/ _,  callback) {
            console.log('IoT Rules Sandbox Service shut down.');
            callback();
        }
    }
};

function listener (rules, inventory) {
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
            console.log('invoking', response.rule)
            invokeLambda({ inventory, src: response.rule, payload: response.payload }, function (err) {
                if (err) console.error(`Error invoking lambda ${response.rule}!`, err);
            });
        }
        // Re-attach the listener after the lambda is dispatched
        process.stdin.once('readable', listener(rules, inventory));
    };
}
