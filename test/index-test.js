const plugin = require('../');
const { join } = require('path');
const inventory = require('@architect/inventory');
const fs = require('fs-extra');
const sampleDir = join(__dirname, '..', 'sample-app');
const appDir = join(__dirname, 'tmp');
const originalCwd = process.cwd();

describe('plugin packaging function', () => {
    let inv = {};
    let arc = {};
    beforeAll(async () => {
        // Set up integration test directory as a copy of sample app
        const appPluginDir = join(appDir, 'node_modules', '@copper', 'plugin-iot-rules');
        await fs.mkdirp(appPluginDir);
        await fs.copy(join(sampleDir, 'app.arc'), join(appDir, 'app.arc'));
        await fs.copy(join(__dirname, '..', 'index.js'), join(appPluginDir, 'index.js'));
        process.chdir(appDir);
        inv = await inventory({});
        arc = inv.inv._project.arc;
    });
    afterAll(async () => {
        process.chdir(originalCwd);
        await fs.remove(appDir);
    });
    describe('when not present in project', () => {
        it('should not modify the CloudFormation JSON', () => {
            const cfn = {};
            const app = { ...arc };
            delete app.rules;
            const output = plugin.package({ arc: app, cloudformation: cfn });
            expect(JSON.stringify(output)).toBe('{}');
        });
    });
    describe('when present in project', () => {
        it('should create a lambda function definition for each rule defined in the arc manifest', () => {
            const cloudformation = {
                Resources: {
                    Role: {
                        Properties: {
                            Policies: []
                        }
                    }
                }
            };
            const app = { ...arc };
            const output = plugin.package({ arc: app, cloudformation, inventory: inv, stage: 'staging' });
            expect(output.Resources.RulesTestPluginLambda).toBeDefined();
            expect(output.Resources.RulesTestPluginLambda.Properties.Events.RulesTestPluginLambdaPluginEvent).toBeDefined();
            expect(output.Resources.RulesTestPluginLambda.Properties.Events.RulesTestPluginLambdaPluginEvent.Type).toEqual('IoTRule');
            expect(output.Resources.RulesTestPluginLambda.Properties.Events.RulesTestPluginLambdaPluginEvent.Properties.Sql).toEqual('SELECT * FROM \'hithere\'');
        });
    });
});
