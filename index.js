let inventory = require('@architect/inventory');
let { createLambda } = require('@architect/package/src/visitors/utils');
let read = require('@architect/inventory/src/read');
let defaultFunctionConfig = require('@architect/inventory/src/defaults/function-config');
let { toLogicalID } = require('@architect/utils');

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
            functionDefn.Properties.Events[`${name}Event`] = {
                Type: 'IoTRule',
                Properties: {
                    AwsIotSqlVersion: '2016-03-23',
                    Sql: query
                }
            };
            cfn.Resources[name] = functionDefn;
        });
    }
    return cfn;
};
