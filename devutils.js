const fs = require("fs-extra");
const path = require("path");
const chalk = require("chalk");

// Find where the module is supposed to be installed
function getInstallPath(manifestPath) {
  const name = fs.readJSONSync(manifestPath).name;
  const config = fs.readJSONSync("foundryconfig.json");

  this.manifestType = path.parse(manifestPath).base;

  // Different types of extensions go in different destinations
  const extensionDir = {
    "module.json": "modules",
    "system.json": "systems",
  }[manifestType];

  if (!config.dataPath) {
    throw Error("No User Data path defined in foundryconfig.json");
  }

  if (!fs.existsSync(path.join(config.dataPath, "Data"))) {
    throw Error("User Data path invalid, no Data directory found");
  }

  return path.join(config.dataPath, "Data", extensionDir, name);
}

// Link build output to FVTT Data folder
async function linkUserData(manifestPath, outDir) {
  const linkDir = getInstallPath(manifestPath);
  if (!(await fs.pathExists(linkDir))) {
    console.log(chalk.green(`Linking build to ${chalk.blueBright(linkDir)}`));
    await fs.symlink(path.resolve(outDir), linkDir);
  }
}

// Unlink build output to FVTT Data folder
async function unlinkUserData(manifestPath) {
  const linkDir = getInstallPath(manifestPath);
  if (!(await fs.pathExists(linkDir))) {
    console.log(chalk.yellow(`Removing build in ${chalk.blueBright(linkDir)}`));
  }
  await fs.remove(linkDir);
}

exports.linkUserData = linkUserData;
exports.unlinkUserData = unlinkUserData;
