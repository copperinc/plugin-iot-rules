let arc = require('@architect/functions');

exports.handler = async (event) => {
    console.log(event);
    let tables = await arc.tables();
    let data = tables.data;
    await data.put({
        dateval: new Date().valueOf(),
        type: 'test',
        ... event
    });
};
