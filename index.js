let inventory = require('@architect/inventory');
let { createLambda } = require('@architect/package/src/visitors/utils');
let read = require('@architect/inventory/src/read');
let defaultFunctionConfig = require('@architect/inventory/src/defaults/function-config');
let { toLogicalID } = require('@architect/utils');
const { prompt } = require('enquirer');

module.exports = async function macroIotRules (arc, cfn /* , stage='staging' */) {
    // modify main role to allow lambdas to publish to iot topics
    if (arc.rules) {
        let appInv = await inventory({});
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
            let code = `./src/rules/${rule[0]}`;
            let name = toLogicalID(rule.shift());
            let query = rule.join(' ').trim();
            // compile any per-function config.arc customizations
            let defaults = defaultFunctionConfig();
            let customizations = read({ type: 'functionConfig', cwd: code }).arc.aws;
            let overrides = {};
            for (let config of customizations) {
                overrides[config[0]] = config[1];
            }
            let functionConfig = { ...defaults, ...overrides };
            let functionDefn = createLambda({
                inventory: appInv,
                lambda: {
                    src: code,
                    config: functionConfig
                }
            });
            functionDefn.Properties.Events[`${name}MacroEvent`] = {
                Type: 'IoTRule',
                Properties: {
                    AwsIotSqlVersion: '2016-03-23',
                    Sql: query
                }
            };
            cfn.Resources[`${name}MacroLambda`] = functionDefn;
        });
    }
    return cfn;
};

module.exports.create = function IoTRulesCreate (inventory) {
    return inventory.inv._project.arc.rules.map((rule) => {
        return {
            src: `./src/rules/${rule[0]}`,
            name: rule[0],
            body: `exports.handler = async function (event) {
  console.log(event);
};`
        };
    });
};

module.exports.start = function IoTRulesServiceStart (inventory) {
    let rules = module.exports.create(inventory).map(rule => rule.src);
    return function IotRulesServiceStartCallback (callback) {
        process.stdin.on('keypress', async function (input, key) {
            if (input === 'I') {
                const response = await prompt([ {
                    type: 'select',
                    name: 'rule',
                    message: 'Which IoT Rule do you want to trigger an event for?',
                    choices: rules
                }, {
                    type: 'input',
                    name: 'payload',
                    message: 'Type out the JSON payload you want to deliver to the rule.',
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
                console.log('enquirer response', response);
            }
        });
        console.log('iot sandbox service started!');
        callback();
    };
};

module.exports.end = function IoTRulesServiceEnd (inventory) {
    return function IoTRulesServiceEndCallback (callback) {
        console.log('iot sandbox service ended!');
        callback();
    };
};
