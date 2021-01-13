# macro-iot-rules

> [Architect](arc.codes) serverless framework macro that defines IoT Topic Rules and associated Lambdas triggered by the Rules

This macro enables your [arc.codes](arc.codes) app to define [IoT](https://docs.aws.amazon.com/iot/latest/developerguide/what-is-aws-iot.html)
[Topic Rules]( https://docs.aws.amazon.com/iot/latest/developerguide/iot-rules.html)
that allow your IoT Devices to trigger arc Lambda functions.

Each IoT Rule defines an event rule that triggers a custom Lambda function. The
Rule employs a [SQL-like syntax][sql] to specify which messages published from your
IoT devices trigger which Lambda functions.

## Installation

1. Run: `npm i github.com/copperinc/macro-iot-rules`

2. Then add the following line to the `@macros` pragma in your Architect project manifest (usually `app.arc`):

        @macros
        copperinc/macro-iot-rules

3. Add a new `@rules` pragma, and add any number of IoT rules by giving it a name
   as the first word (the following characters are allowed in names: `[a-zA-Z0-9_-]`).
   This name is also the name of the custom Lambda function that will triggered
   by this rule. Follow that with a SQL query which will trigger the Lambda (see
   the [IoT SQL Reference][sql]). For example:

        @rules
        connect-device SELECT * FROM '$aws/events/presence/connected/+'
        disconnect-device SELECT * FROM '$aws/events/presence/disconnected/+'
        report-device-state SELECT clientid() as clientId, principal() as principalIdentifier, state.reported as state from '$aws/things/+/shadow/update'

4. Create a folder under `src/rules` for each added rule, matching the name of your
   rule. Following the example from the last step, we would create the folders
   `src/rules/connect-device`, `src/rules/disconnect-device` and
   `src/rules/report-device-state`.

5. Copy the files from this repo's `example-lambda/` folder into each
   `src/rules/*` subdirectory.

6. Edit each rule Lambda's `index.js` file, just as you would any classic arc
   `@http`, `@events`, etc. function.

[sql]: https://docs.aws.amazon.com/iot/latest/developerguide/iot-sql-reference.html
