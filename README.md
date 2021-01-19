# macro-iot-rules

> [Architect](arc.codes) serverless framework macro that defines IoT Topic Rules and associated Lambdas triggered by the Rules

This macro enables your [arc.codes](arc.codes) app to define [IoT](https://docs.aws.amazon.com/iot/latest/developerguide/what-is-aws-iot.html)
[Topic Rules]( https://docs.aws.amazon.com/iot/latest/developerguide/iot-rules.html)
that allow your IoT Devices to trigger arc Lambda functions.

Each IoT Rule defines an event rule that triggers a custom Lambda function. The
Rule employs a [SQL-like syntax][sql] to specify which messages published from your
IoT devices trigger which Lambda functions.

## Installation

1. Run: `npm i copperinc/macro-iot-rules`

2. Then add the following line to the `@macros` pragma in your Architect project manifest (usually `app.arc`):

        @macros
        macro-iot-rules

3. Add a new `@rules` pragma, and add any number of IoT rules by giving it a name
   as the first word (the following characters are allowed in names: `[a-zA-Z0-9_-]`).
   This name is also the name of the custom Lambda function that will triggered
   by this rule. Follow that with a SQL query which will trigger the Lambda (see
   the [IoT SQL Reference][sql]). For example:

        @rules
        connect-device SELECT * FROM '$aws/events/presence/connected/+'
        disconnect-device SELECT * FROM '$aws/events/presence/disconnected/+'
        report-device-state SELECT clientid() as clientId, principal() as principalIdentifier, state.reported as state from '$aws/things/+/shadow/update'

4. Run `arc create` to generate your IoT Rule Lambda functions (under
   `src/rules`) based on the rules you added to your `app.arc` file under the `@rules`
   pragma.

5. Edit each rule Lambda's `index.js` file, just as you would any classic arc
   `@http`, `@events`, etc. function.

## Sample Application

There is a sample application located under `sample-app/`. `cd` into that
directory, `npm install` and you can directly deploy using `arc deploy`.

To test the application out:

1. Head to the [IoT Core Console's MQTT Test Page](https://us-west-1.console.aws.amazon.com/iot/home?region=us-west-1#/test)
   (sometimes, soon after deployment, this test console will not be ready as a red
   banner will inform you; if you find that, give it a few minutes and refresh the
   page).
2. Click "Publish to a topic."
3. In the topic input field, enter 'hithere' (it should match the `FROM` clause
   of the `@rules` section of `app.arc`). Optionally, customize the message
   payload.
4. Load the deployed URL of the app, and a list of all messages sent to the
   `hithere` topic should be displayed.

[sql]: https://docs.aws.amazon.com/iot/latest/developerguide/iot-sql-reference.html
