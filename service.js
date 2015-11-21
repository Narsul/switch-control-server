var Service = require('node-mac').Service;
var path = require('path');

// Create a new service object
var svc = new Service({
  name: 'SwitchControlServer',
  description: 'HTTP wrapper for modbus light switch',
  script: path.join(__dirname, 'server.js')
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function() {
  console.log('Install complete.');
  console.log('The service exists: ', svc.exists);
  svc.start();
});

// Listen for the "uninstall" event so we know when it's done.
svc.on('uninstall',function(){
  console.log('Uninstall complete.');
  console.log('The service exists: ', svc.exists);
});

var action = process.argv[2];

switch (action) {
  case 'install':
    svc.install();
    break;

  case 'uninstall':
    svc.uninstall();
    break;

  case 'status':
    console.log('The service exists: ', svc.exists);
    break;

  default:
    console.log('Supported actions: install, uninstall, status');
}
