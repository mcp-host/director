import boxen from "boxen";
import chalk from "chalk";
import semverGt from "semver/functions/gt.js";
import updateNotifier from "update-notifier";
import packageJson from "../package.json" assert { type: "json" };

export async function checkForUpdates() {
  const notifier = updateNotifier({
    pkg: packageJson,
    // Check for updates every hour while we ship often
    updateCheckInterval: 1000 * 60 * 60,
  });

  const info = await notifier.fetchInfo();

  if (info && semverGt(info.latest, info.current)) {
    const defaultTemplate =
      chalk.bold(
        "Update available " +
          chalk.dim(info.current) +
          chalk.reset(" → ") +
          chalk.green(info.latest),
      ) +
      " \n\nTo continue using Director, please update to the latest version.\n\nRun " +
      chalk.cyan("npm install -g @director.run/cli");

    console.log();
    console.log(
      boxen(defaultTemplate, {
        padding: 1,
        borderStyle: "double",
        borderColor: "yellow",
      }),
    );
    console.log();
  }
}
