'use strict';

// Compatibility entry point for deployments that still reference the old filename.
// The helper binds only to its protected Unix socket; the public panel is a separate service.
require('./ssh-ops-helper');
