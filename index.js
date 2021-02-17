let { createLambda } = require('@architect/package/src/visitors/utils');
let read = require('@architect/inventory/src/read');
let defaultFunctionConfig = require('@architect/inventory/src/defaults/function-config');
let { toLogicalID } = require('@architect/utils');
let invokeLambda = require('@architect/sandbox/src/invoke-lambda');
const { prompt } = require('enquirer');
const { join } = require('path');

module.exports = async function macroIotRules (arc, cfn, stage = 'staging', inventory) {
    // modify main role to allow lambdas to publish to iot topics
    if (arc.rules) {
        const cwd = inventory.inv._project.src;
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
            let code = join(cwd, 'src', 'rules', rule[0]);
            let name = toLogicalID(rule.shift());
            let query = rule.join(' ').trim();
            let functionConfig = getFunctionConfig(code);
            let functionDefn = createLambda({
                inventory,
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
    const cwd = inventory.inv._project.src;
    return inventory.inv._project.arc.rules.map((rule) => {
        let rulesSrc = join(cwd, 'src', 'rules', rule[0]);
        let functionConfig = getFunctionConfig(rulesSrc);
        return {
            src: rulesSrc,
            config: functionConfig,
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
        process.stdin.on('keypress', async function IoTRulesKeyListener (input, key) {
            if (input === 'I') {
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
                // Assemble invocation params and use sandbox's own lambda
                // invoker to trigger the lambda with an event
                let lambdaInvocationParams = {
                    lambda: {
                        src: response.rule,
                        config: getFunctionConfig(response.rule),
                        _proxy: true // short circuits sandbox's lambda invocation handler checker
                    },
                    event: response.payload,
                    inventory
                };
                invokeLambda(lambdaInvocationParams, function (err, result) {
                    if (err) console.error(`Error invoking lambda ${response.rule}!`, err);
                    else console.log(`${response.rule} invocation result:`, result);
                });
            }
        });
        console.log('IoT Rules Sandbox Service Started; press "I" (capital letter) to trigger a rule.');
        callback();
    };
};

module.exports.end = function IoTRulesServiceEnd (inventory) {
    return function IoTRulesServiceEndCallback (callback) {
        console.log('IoT Rules Sandbox Service shut down.');
        callback();
    };
};

// compile any per-function config.arc customizations
function getFunctionConfig (dir) {
    // compile any per-function config.arc customizations
    let defaults = defaultFunctionConfig();
    let existingConfig = read({ type: 'functionConfig', cwd: dir });
    let customizations = [];
    if (existingConfig.arc) customizations = existingConfig.arc.aws || [];
    let overrides = {};
    for (let config of customizations) {
        overrides[config[0]] = config[1];
    }
    return { ...defaults, ...overrides };
}

