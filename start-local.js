'use strict';

// Optional local launcher. The actual npm start command runs server.js directly.
// server.js uses __dirname for all project paths, so Nova does not depend on cwd.
require(require('path').join(__dirname, 'server.js'));
