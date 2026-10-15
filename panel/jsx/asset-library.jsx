var FlowAssetLibrary = FlowAssetLibrary || {};

(function (api) {
    function escapeResultText(value) {
        return String(value)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, "\\\"")
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n");
    }

    function result(ok, message) {
        return '{"ok":' + (ok ? 'true' : 'false') + ',"message":"' + escapeResultText(message || '') + '"}';
    }

    function activeComp() {
        var comp = app.project && app.project.activeItem;

        if (!comp || !(comp instanceof CompItem)) {
            throw new Error("Open or select a composition first.");
        }

        return comp;
    }

    function normalizePath(value) {
        return String(value || "").replace(/\\/g, "/").toLowerCase();
    }

    function findImportedFootage(file) {
        var targetPath = normalizePath(file.fsName);

        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);

            try {
                if (!(item instanceof FootageItem) || !item.mainSource || !item.mainSource.file) {
                    continue;
                }

                if (normalizePath(item.mainSource.file.fsName) === targetPath) {
                    return item;
                }
            } catch (error) {
            }
        }

        return null;
    }

    function findFolder(name, parent) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);

            if (!(item instanceof FolderItem) || item.name !== name) {
                continue;
            }

            if (!parent || item.parentFolder === parent) {
                return item;
            }
        }

        return null;
    }

    function getAssetFolder(libraryName) {
        var root = findFolder("Flow Assets", null);

        if (!root) {
            root = app.project.items.addFolder("Flow Assets");
        }

        var folder = findFolder(libraryName, root);

        if (!folder) {
            folder = app.project.items.addFolder(libraryName);
            folder.parentFolder = root;
        }

        return folder;
    }

    function importAsset(file, libraryName) {
        var options = new ImportOptions(file);
        options.sequence = false;

        if (!options.canImportAs(ImportAsType.FOOTAGE)) {
            throw new Error("After Effects cannot import this file as footage.");
        }

        options.importAs = ImportAsType.FOOTAGE;
        var imported = app.project.importFile(options);
        imported.parentFolder = getAssetFolder(libraryName || "Library");
        return imported;
    }

    api.add = function (filePath, displayName, libraryName) {
        var undoOpen = false;

        try {
            var comp = activeComp();
            var file = new File(filePath);

            if (!file.exists) {
                return result(false, "This asset is missing. Put the file back in its original location and try again.");
            }

            app.beginUndoGroup("Flow: Add Asset");
            undoOpen = true;

            var footage = findImportedFootage(file) || importAsset(file, libraryName);
            var layer = comp.layers.add(footage);
            var position = layer.property("ADBE Transform Group").property("ADBE Position");

            layer.name = displayName || footage.name;

            if (position) {
                position.setValue([comp.width / 2, comp.height / 2]);
            }

            app.endUndoGroup();
            undoOpen = false;
            return result(true, "Added " + layer.name + " to the composition.");
        } catch (error) {
            if (undoOpen) {
                app.endUndoGroup();
            }

            return result(false, error.toString());
        }
    };
})(FlowAssetLibrary);
