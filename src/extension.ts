import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface LogEntry {
    file_path: string;
    line_number: number;
    log_type: 'warning' | 'error';
    error_code?: string;
    message: string;
}

export function activate(context: vscode.ExtensionContext) {
    const treeDataProvider = new LogTreeDataProvider(vscode.workspace.rootPath);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('buildListView', treeDataProvider)
    );
}

class LogTreeDataProvider implements vscode.TreeDataProvider<LogTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<LogTreeItem | undefined | null | void> = new vscode.EventEmitter<LogTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<LogTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private logEntries: LogEntry[] = [];

    constructor(private workspaceRoot: string | undefined) {
        this.loadLogData();

        const buildJsonPath = this.getLogJsonPath();
        if (buildJsonPath) {
            fs.watchFile(buildJsonPath, (curr, prev) => {
                if (curr.mtimeMs !== prev.mtimeMs) {
                    this.loadLogData();
                    this._onDidChangeTreeData.fire();
                }
            });
        }
    }

    private getLogJsonPath(): string | undefined {
        const gta2Root = process.env.GTA2_ROOT;
        if (gta2Root) {
            return path.join(gta2Root, 'build.json');
        }
        vscode.window.showErrorMessage('GTA2_ROOT environment variable is not set.');
        return undefined;
    }

    private loadLogData(): void {
        const logJsonPath = this.getLogJsonPath();
        if (logJsonPath) {
            try {
                const jsonData = fs.readFileSync(logJsonPath, 'utf-8');
                this.logEntries = JSON.parse(jsonData) as LogEntry[];
            } catch (error) {
                vscode.window.showErrorMessage(`Error reading or parsing build.json: ${error}`);
                this.logEntries = [];
            }
        } else {
            this.logEntries = [];
        }
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: LogTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: LogTreeItem): LogTreeItem[] {
        if (!this.logEntries || this.logEntries.length === 0) {
            return [];
        }
    
        const sortedEntries = [...this.logEntries].sort((a, b) => {
            return (a.log_type === "error" ? 0 : 1) - (b.log_type === "error" ? 0 : 1);
        });
    
        return sortedEntries.map(entry => new LogTreeItem(entry));
    }
}

class LogTreeItem extends vscode.TreeItem {
    constructor(public readonly logEntry: LogEntry) {
        super(`${path.basename(logEntry.file_path)}:${logEntry.line_number}`, vscode.TreeItemCollapsibleState.None);

        this.description = `${logEntry.error_code ? `(${logEntry.error_code})` : ''}: ${logEntry.message}`;
        this.tooltip = `${logEntry.file_path}\nLine: ${logEntry.line_number}\nType: ${logEntry.log_type}\n${logEntry.error_code ? `Code: ${logEntry.error_code}\n` : ''}Message: ${logEntry.message}`;

        switch (logEntry.log_type) {
            case 'warning':
                this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
                break;
            case 'error':
                this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('list.errorForeground'));
                break;
            default:
                break;
        }

        this.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [
                vscode.Uri.file(logEntry.file_path),
                {
                    selection: new vscode.Range(
                        logEntry.line_number - 1,
                        0,
                        logEntry.line_number - 1,
                        0
                    )
                }
            ]
        };
    }
}

export function deactivate() { }