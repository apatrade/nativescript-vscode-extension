import * as vscode from 'vscode';
import * as child from 'child_process';
import * as ns from './nativeScript';

// this method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    let haveToShowWarningForIncompatibleCli = ns.CliInfo.isExisting() && !ns.CliInfo.isCompatible();

    let iosRunOptions = ['device', 'emulator'];
    let androidRunOptions = ['device', 'emulator'];

    let runCommandHandler = (project: ns.NSProject, options: string[]) => {
        if (!ns.CliInfo.isExisting()) {
            vscode.window.showErrorMessage(ns.CliInfo.getMessage());
            return;
        }

        let showWarningIfNeeded: Thenable<any> = Promise.resolve();
        if (haveToShowWarningForIncompatibleCli) {
            showWarningIfNeeded = vscode.window.showWarningMessage(ns.CliInfo.getMessage());
            haveToShowWarningForIncompatibleCli = false;
        }

        showWarningIfNeeded.then(() => {
            if (vscode.workspace.rootPath === undefined) {
                vscode.window.showErrorMessage('No workspace opened.');
                return;
            }

            vscode.window.showQuickPick(options)
            .then(target => {
                if(target == undefined) {
                    return; // e.g. if the user presses escape button
                }

                // Move the selected option to be the first element in order to keep the last selected option at the top of the list
                options.splice(options.indexOf(target), 1);
                options.unshift(target);

                // Show output channel
                let runChannel: vscode.OutputChannel = vscode.window.createOutputChannel('Run on iOS');
                runChannel.clear();
                runChannel.show(vscode.ViewColumn.Two);

                // Execute run command
                let emulator: boolean = (target === 'emulator');
                return project.run(emulator)
                .then(tnsProcess => {
                    tnsProcess.on('error', err => {
                        vscode.window.showErrorMessage('Unexpected error executing NativeScript Run command.');
                    });
                    tnsProcess.stderr.on('data', data => {
                        runChannel.append(data);
                    });
                    tnsProcess.stdout.on('data', data => {
                        runChannel.append(data);
                    });
                    tnsProcess.on('exit', exitCode => {
                        tnsProcess.stdout.removeAllListeners('data');
                        tnsProcess.stderr.removeAllListeners('data');
                    });
                    tnsProcess.on('close', exitCode => {
                        runChannel.hide();
                    });
                });
            });
        });
    };

    let runIosCommand = vscode.commands.registerCommand('nativescript.runIos', () => {
        return runCommandHandler(new ns.IosProject(vscode.workspace.rootPath), iosRunOptions);
    });

    let runAndroidCommand = vscode.commands.registerCommand('nativescript.runAndroid', () => {
        return runCommandHandler(new ns.AndroidProject(vscode.workspace.rootPath), iosRunOptions);
    });

    context.subscriptions.push(runIosCommand);
    context.subscriptions.push(runAndroidCommand);
}