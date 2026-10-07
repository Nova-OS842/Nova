Nova Developer Passwords

Edit config/developer-config.js to change the Developer Bypass passwords.
Keep this file server-side and do not publish the real passwords in a public repository.
You can define one or multiple passwords in the passwords array.

Example:
module.exports = {
  passwords: [
    'your-password',
    'other-developer-password'
  ]
};
