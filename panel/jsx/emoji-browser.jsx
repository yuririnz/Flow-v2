var FlowEmojiBrowser = FlowEmojiBrowser || {};

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

    function getEmojiFolder() {
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);

            if (item instanceof FolderItem && item.name === "Flow Emoji") {
                return item;
            }
        }

        return app.project.items.addFolder("Flow Emoji");
    }

    function importEmoji(file) {
        var options = new ImportOptions(file);
        options.sequence = false;
        var imported = app.project.importFile(options);
        imported.parentFolder = getEmojiFolder();
        return imported;
    }

    api.add = function (filePath, displayName) {
        var undoOpen = false;

        try {
            var comp = activeComp();
            var file = new File(filePath);

            if (!file.exists) {
                return result(false, "The selected emoji file is missing. Reinstall Flow to restore it.");
            }

            app.beginUndoGroup("Flow: Add Emoji");
            undoOpen = true;

            var footage = findImportedFootage(file) || importEmoji(file);
            var layer = comp.layers.add(footage);
            var position = layer.property("ADBE Transform Group").property("ADBE Position");

            layer.name = displayName || footage.name;

            if (position) {
                position.setValue([comp.width / 2, comp.height / 2]);
            }

            app.endUndoGroup();
            undoOpen = false;
            return result(true, "Added " + layer.name + ".");
        } catch (error) {
            if (undoOpen) {
                app.endUndoGroup();
            }

            return result(false, error.toString());
        }
    };
})(FlowEmojiBrowser);
