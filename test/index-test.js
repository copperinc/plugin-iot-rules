const plugin = require('../');

const arc = { http: [ [ 'get', '/' ], [ 'post', '/accounts' ] ] };

describe('macro packaging function', () => {
    describe('when not present in project', () => {
        it('should not modify the CloudFormation JSON', () => {
            const cfn = {};
            const output = macro(arc, cfn);
            expect(JSON.stringify(output)).toBe('{}');
        });
    });
    describe('when present in project', () => {
        it('should assign a CorsConfiguration property', () => {
            const cfn = {
                Resources: {
                    HTTP: {
                        Properties: {}
                    }
                }
            };
            const cors = [ [ 'AllowCredentials', true ] ];
            const app = { cors, ...arc };
            const output = macro(app, cfn);
            expect(output.Resources.HTTP.Properties.CorsConfiguration.AllowCredentials).toBe(true);
        });
    });
});
