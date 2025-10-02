I used this test to validate the structure of flow card against the Homey flow schema. 
One test succeeds and one test fails on purpose. 


You need to install the schema validation facility:

npm install -g ajv
npm install -g ajv-cli
#removed the _comment line from the capability-schema.json

❯ ajv validate -s capability-schema -d capability-example
capability-example valid

❯ ajv validate -s capability-schema -d capability-example2
capability-example2 invalid
[
  {
    instancePath: '/values/0',
    schemaPath: '#/properties/values/items/type',
    keyword: 'type',
    params: { type: 'object' },
    message: 'must be object'
  }
]
