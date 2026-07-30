import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
    addBlockIntegration,
} from "../../bin/create-component.js";

async function createComponentFixture(testContext, componentName = "notice") {
    const root = await mkdtemp(
        path.join(os.tmpdir(), "ave-ui-generator-"),
    );
    const componentDirectory = path.join(root, componentName);
    const manifestFile = path.join(
        componentDirectory,
        `${componentName}.component.json`,
    );

    testContext.after(async () => {
        await rm(root, {
            force: true,
            recursive: true,
        });
    });

    await mkdir(componentDirectory, {
        recursive: true,
    });
    await writeFile(
        path.join(componentDirectory, `${componentName}.acf.php`),
        "<?php\n",
    );
    await writeFile(
        path.join(componentDirectory, `${componentName}.class.php`),
        "<?php\n",
    );
    await writeFile(
        manifestFile,
        `${JSON.stringify({
            name: componentName,
            displayName: "Notice",
            description: "Notice component",
            integrations: {
                wordpress: {
                    acfFields: {
                        supported: true,
                        file: `${componentName}.acf.php`,
                    },
                },
            },
        }, null, 3)}\n`,
    );

    return {
        componentDirectory,
        manifestFile,
        root,
    };
}

test("adds block integration without replacing component source", async (context) => {
    const fixture = await createComponentFixture(context);
    let validationCalls = 0;

    const result = await addBlockIntegration({
        componentName: "notice",
        root: fixture.root,
        validate: async () => {
            validationCalls += 1;
        },
    });

    assert.equal(result.status, "created");
    assert.equal(validationCalls, 1);

    const manifest = JSON.parse(
        await readFile(fixture.manifestFile, "utf8"),
    );
    const block = await readFile(
        path.join(fixture.componentDirectory, "notice.block.php"),
        "utf8",
    );

    assert.deepEqual(
        manifest.integrations.wordpress.acfBlock,
        {
            supported: true,
            file: "notice.block.php",
            name: "avenue/notice",
        },
    );
    assert.match(block, /use AvenueUI\\Components\\Notice;/);
    assert.match(block, /    'name' => 'notice'/);
});

test("is a no-op when complete block integration already exists", async (context) => {
    const fixture = await createComponentFixture(context);

    await addBlockIntegration({
        componentName: "notice",
        root: fixture.root,
        validate: async () => {},
    });

    let validationCalls = 0;
    const result = await addBlockIntegration({
        componentName: "notice",
        root: fixture.root,
        validate: async () => {
            validationCalls += 1;
        },
    });

    assert.deepEqual(result, {
        status: "unchanged",
        files: [],
    });
    assert.equal(validationCalls, 0);
});

test("rejects components without ACF field integration", async (context) => {
    const fixture = await createComponentFixture(context);
    const manifest = JSON.parse(
        await readFile(fixture.manifestFile, "utf8"),
    );

    delete manifest.integrations.wordpress.acfFields;
    await writeFile(
        fixture.manifestFile,
        `${JSON.stringify(manifest, null, 3)}\n`,
    );

    await assert.rejects(
        addBlockIntegration({
            componentName: "notice",
            root: fixture.root,
            validate: async () => {},
        }),
        /must provide ACF fields/,
    );
});

test("rolls back generated files when registry validation fails", async (context) => {
    const fixture = await createComponentFixture(context);
    const originalManifest = await readFile(
        fixture.manifestFile,
        "utf8",
    );
    let recoveryCalls = 0;

    await assert.rejects(
        addBlockIntegration({
            componentName: "notice",
            root: fixture.root,
            validate: async () => {
                throw new Error("Registry validation failed");
            },
            recover: async () => {
                recoveryCalls += 1;
            },
        }),
        /Registry validation failed/,
    );

    assert.equal(
        await readFile(fixture.manifestFile, "utf8"),
        originalManifest,
    );
    assert.equal(recoveryCalls, 1);
    await assert.rejects(
        readFile(
            path.join(fixture.componentDirectory, "notice.block.php"),
            "utf8",
        ),
        {
            code: "ENOENT",
        },
    );
});
