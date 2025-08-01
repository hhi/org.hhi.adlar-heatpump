// or ESM/TypeScript import
import Ajv from 'ajv';
// Node.js require:
const Ajv = require('ajv');

const ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}

const schema = {
  title: 'Capability',
  type: 'object',
  definitions: {
    i18nObject: {
      oneOf: [
        {
          type: 'string',
          minLength: 1,
        },
        {
          type: 'object',
          required: [
            'en',
          ],
          patternProperties: {
            '^.*$': {
              type: 'string',
            },
          },
          additionalProperties: false,
        },
      ],
    },
  },
  required: [
    'title',
    'type',
  ],
  anyOf: [
    {
      required: [
        'getable',
      ],
    },
    {
      required: [
        'setable',
      ],
    },
  ],
  properties: {
    title: {
      $ref: '#/definitions/i18nObject',
    },
    desc: {
      $ref: '#/definitions/i18nObject',
    },
    type: {
      type: 'string',
      enum: [
        'boolean',
        'number',
        'string',
        'enum',
      ],
    },
    getable: {
      type: 'boolean',
      default: true,
    },
    setable: {
      type: 'boolean',
      default: true,
    },
    icon: {
      type: 'string',
    },
    insights: {
      type: 'boolean',
    },
    insightsTitleTrue: {
      $ref: '#/definitions/i18nObject',
    },
    insightsTitleFalse: {
      $ref: '#/definitions/i18nObject',
    },
    chartType: {
      type: 'string',
      enum: [
        'line',
        'area',
        'stepLine',
        'column',
        'spline',
        'splineArea',
        'scatter',
      ],
    },
    decimals: {
      type: 'number',
    },
    min: {
      type: 'number',
    },
    max: {
      type: 'number',
    },
    step: {
      type: 'number',
      minimum: 0,
    },
    units: {
      $ref: '#/definitions/i18nObject',
    },
    values: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'title',
        ],
        properties: {
          id: {
            type: 'string',
          },
          title: {
            $ref: '#/definitions/i18nObject',
          },
        },
      },
    },
    uiComponent: {
      oneOf: [
        {
          type: 'string',
          enum: [
            'thermostat',
            'media',
            'toggle',
            'slider',
            'ternary',
            'button',
            'color',
            'picker',
            'sensor',
            'battery',
          ],
        },
        {
          type: 'null',
        },
      ],
    },
  },
  _comment: 'Require `values` array when `type` is `enum`',
  oneOf: [
    {
      properties: {
        type: {
          type: 'string',
          enum: [
            'enum',
          ],
        },
      },
      required: [
        'values',
      ],
    },
    {
      properties: {
        type: {
          type: 'string',
          enum: [
            'boolean',
            'number',
            'string',
          ],
        },
      },
    },
  ],
};

const data = {
  id: 'adlar_measure_pulse_steps.temp_current',
  title: {
    en: 'EEV Open',
    nl: 'EEV Open',
  },
  type: 'number',
  units: {
    en: 'Pulse-steps',
    nl: 'Puls-stappen',
  },

  min: -500,
  max: 500,
  step: 1,
  decimals: 0,

  getable: true,
  setable: false,
  uiComponent: 'sensor',
  insights: true,
  insightsTitle: {
    en: 'EEV Open',
    nl: 'EEV Open',
  },

  description: {
    nl: 'dp 16 : temp_current - EEV Open',
  },
};

const validate = ajv.compile(schema);
const valid = validate(data);
if (!valid) console.log(validate.errors);
