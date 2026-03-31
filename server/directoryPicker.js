const { execFile } = require('child_process');

function execFileAsync(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve((stdout || '').trim());
    });
  });
}

async function pickDirectoryOnMac() {
  return execFileAsync('osascript', [
    '-e',
    'try',
    '-e',
    'POSIX path of (choose folder with prompt "Choose a folder to scan in DesignVault")',
    '-e',
    'on error number -128',
    '-e',
    'return ""',
    '-e',
    'end try',
  ]);
}

async function pickDirectoryOnWindows() {
  return execFileAsync('powershell', [
    '-NoProfile',
    '-Command',
    [
      'Add-Type -AssemblyName System.Windows.Forms;',
      '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog;',
      '$dialog.Description = "Choose a folder to scan in DesignVault";',
      '$dialog.ShowNewFolderButton = $false;',
      'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {',
      '  Write-Output $dialog.SelectedPath',
      '}',
    ].join(' '),
  ]);
}

async function pickDirectoryOnLinux() {
  try {
    return await execFileAsync('zenity', [
      '--file-selection',
      '--directory',
      '--title=Choose a folder to scan in DesignVault',
    ]);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  try {
    return await execFileAsync('kdialog', [
      '--getexistingdirectory',
      process.env.HOME || '/',
      'Choose a folder to scan in DesignVault',
    ]);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  throw new Error('No native folder picker is available on this system');
}

async function pickDirectory() {
  if (process.platform === 'darwin') {
    return pickDirectoryOnMac();
  }

  if (process.platform === 'win32') {
    return pickDirectoryOnWindows();
  }

  return pickDirectoryOnLinux();
}

module.exports = { pickDirectory };
