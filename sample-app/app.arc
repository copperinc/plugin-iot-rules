@app
plugin-iot-rules-demo

@http
get /

@static
fingerprint true

@tables
data
  dateval *Number

@rules
test SELECT * FROM 'hithere'

@plugins
copper/plugin-iot-rules
