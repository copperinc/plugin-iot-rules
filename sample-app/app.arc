@app
macro-iot-rules-demo

@http
get /

@static
fingerprint true

@tables
data
  dateval *Number

@rules
test SELECT * FROM 'hithere'

@macros
macro-iot-rules
