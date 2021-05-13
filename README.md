# plugin-iot-rules

> [Architect](arc.codes) serverless framework plugin that defines IoT Topic Rules and associated Lambdas triggered by the Rules

This plugin enables your [arc.codes](arc.codes) app to define [IoT](https://docs.aws.amazon.com/iot/latest/developerguide/what-is-aws-iot.html)
[Topic Rules]( https://docs.aws.amazon.com/iot/latest/developerguide/iot-rules.html)
that allow your IoT Devices to trigger arc Lambda functions.

Each IoT Rule defines an event rule that triggers a custom Lambda function. The
Rule employs a [SQL-like syntax][sql] to specify which messages published from your
IoT devices trigger which Lambda functions.

## Installation

1. Install this plugin: `npm i @copper/plugin-iot-rules`

2. Then add the following line to the `@plugins` pragma in your Architect project manifest (usually `app.arc`):

        @plugins
        copper/plugin-iot-rules

3. Add a new `@rules` pragma, and add any number of IoT rules by giving each a name
   as the first word (the following characters are allowed in names: `[a-zA-Z0-9_-]`).
   This name is will form part of the name of the custom Lambda function that will be triggered
   by this rule. Follow the name with a SQL query which will trigger the Lambda (see
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
directory, `npm install` and you can run locally via `arc sandbox` or deploy to
the internet via `arc deploy`.

### Testing Locally

This plugin extends `arc sandbox` to provide a local development experience:

1. Kick up the local development environment by running the sandbox: `arc sandbox`
   (note the additional message logged out by Sandbox informing you of an
   additional local IoT service starting up).
2. Load up http://localhost:3333 - the JSON array at the bottom of the page
   lists out all IoT events received on the IoT Rule Topic. It should initially
   be empty.
3. With sandbox running, press the "i" key to trigger an IoT Rule. You will be
   prompted to choose an IoT Rule (the sample app contains only a single rule),
   then to enter a JSON object as a payload to deliver to the rule.
4. Reload http://localhost:3333 - your JSON payload should be listed at the
   bottom of the page.

### Testing the Deployed Version

The sample application is ready deploy to staging via `arc deploy`. Then:

1. Load the URL of your deployed app; note the JSON array at the bottom of the
   page and the objects it contains (if this is the first time you have
   deployed, it will be empty).
1. Head to the [IoT Core Console's MQTT Test Page](https://us-west-1.console.aws.amazon.com/iot/home?region=us-west-1#/test)
   (sometimes, soon after deployment, this test console will not be ready as a red
   banner will inform you; if you find that, give it a few minutes and refresh the
   page). From the IoT Core page on AWS, click the "Test" menu link on the left.
2. Click "Publish to a topic."
3. In the topic input field, enter 'hithere' (it should match the `FROM` clause
   of the `@rules` section of `app.arc`). Optionally, customize the message
   payload.
4. Load the deployed URL of the app, and a list of all messages sent to the
   `hithere` topic should be displayed.

# Contributing

Thanks for considering contributing to this project! Check out the
[contribution guidelines](CONTRIBUTING.md) for details.

[sql]: https://docs.aws.amazon.com/iot/latest/developerguide/iot-sql-reference.html
