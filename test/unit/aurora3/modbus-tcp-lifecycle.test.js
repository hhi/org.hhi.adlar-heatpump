// Tests intentionally load the TypeScript build output.
/* eslint-disable node/no-unpublished-require */

'use strict';

require('../../support/modbus-tcp-lifecycle')(require.resolve('../../../.homeybuild/lib/aurora3/protocol/modbus-tcp-service'));
