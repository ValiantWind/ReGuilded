import { promises as fsPromises, readFile, writeFile } from "fs";
import ExtensionManager from "./extension-manager";
import { Theme } from "../common/extensions";
import { isAbsolute, join } from "path";

// TODO: Checking
export default class ThemeManager extends ExtensionManager<Theme> {
    themeIdToCssList: { [extensionId: string]: string[] };
    constructor(dirname: string) {
        super(dirname);

        this.themeIdToCssList = {};

        this.exportable.getAllCss = this.getAllCss.bind(this);
        this.exportable.setThemeSettings = this.setThemeSettings.bind(this);
    }
    getAllCss() {
        return this.themeIdToCssList;
    }
    /**
     * Sets the new theme settings value properties.
     * @param themeId The name of the theme
     * @param props The settings property values
     */
    setThemeSettings(
        themeId: string,
        props: { [settingsProp: string]: string | number | boolean | undefined }
    ) {
        const metadata = this.idsToMetadata[themeId];

        if (!metadata) throw new Error(`Theme by ID '${themeId}' does not exist.`);

        for (let prop in props) metadata.settings[prop].value = props[prop];

        // Write file and let the watcher update the theme
        writeFile(
            join(metadata.dirname, "settings.json"),
            JSON.stringify(metadata.settings),
            e => {
                if (e) console.error(e);
            }
        );
    }
    protected override async onFileChange(metadata: Theme): Promise<void> {
        const styleSheets: string[] = [];

        const files = typeof metadata.files === "string" ? [metadata.files] : metadata.files;

        metadata.files = files;

        for (let file of files)
            await fsPromises
                .readFile(ThemeManager.getCssPath(metadata.dirname, file), "utf8")
                .then(d => (styleSheets.push(d)))
                .catch(e =>
                    console.error("Error in '", metadata.id, "' related to CSS files:", e)
                );

        this.themeIdToCssList[metadata.id] = styleSheets;

        readFile(join(metadata.dirname, "settings.json"), "utf8", (e, d) => {
            if (e)
                if (e.code === "ENOENT") return;
                else
                    return console.error(
                        "Error reading theme '",
                        metadata.id,
                        "' settings file:",
                        e
                    );

            let settings = JSON.parse(d);

            // Validate settings
            if (typeof settings !== "object")
                console.error(
                    "Expected theme by ID '",
                    metadata.id,
                    "' to have object at the root of settings.json."
                );

            metadata.settingsProps = Object.keys((metadata.settings = settings));
        });
    }
    /**
     * Gets the absolute path to the CSS file.
     * @param themePath The path to the theme's directory
     * @param cssPath The path to the CSS file
     * @returns The absolute path to CSS file
     */
    static getCssPath(themePath: string, cssPath: string) {
        return isAbsolute(cssPath) ? cssPath : join(themePath, cssPath);
    }
}
