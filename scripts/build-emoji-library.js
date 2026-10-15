/* global process */
'use strict';

var fs = require('fs');
var path = require('path');

var projectRoot = path.resolve(__dirname, '..');
var sourceRoot = path.resolve(process.argv[2] || path.join(projectRoot, '..', 'iOS_26_4_Emoji_ORDERED'));
var destinationRoot = path.join(projectRoot, 'panel', 'files', 'emoji', 'ios-26.4');
var allSource = path.join(sourceRoot, '00_ALL_IN_KEYBOARD_ORDER');
var extrasSource = path.join(sourceRoot, '99_EXTRAS_NOT_IN_UNICODE_KEYBOARD_ORDER');
var categoriesSource = path.join(sourceRoot, 'Categories');
var allDestination = path.join(destinationRoot, 'all');
var extrasDestination = path.join(destinationRoot, 'extras');

var categoryLabels = {
  '01_Smileys_&_Emotion': 'Smileys',
  '02_People_&_Body': 'People',
  '03_Component': 'Components',
  '04_Animals_&_Nature': 'Nature',
  '05_Food_&_Drink': 'Food',
  '06_Travel_&_Places': 'Travel',
  '07_Activities': 'Activities',
  '08_Objects': 'Objects',
  '09_Symbols': 'Symbols',
  '10_Flags': 'Flags'
};

function ensureDirectory(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function pngFiles(directory) {
  return fs.readdirSync(directory)
    .filter(function (file) { return /\.png$/i.test(file); })
    .sort();
}

function walkPngFiles(directory, result) {
  var entries = fs.readdirSync(directory, { withFileTypes: true });

  for (var i = 0; i < entries.length; i++) {
    var fullPath = path.join(directory, entries[i].name);

    if (entries[i].isDirectory()) {
      walkPngFiles(fullPath, result);
    } else if (/\.png$/i.test(entries[i].name)) {
      result.push(entries[i].name);
    }
  }
}

function copyFiles(files, source, destination) {
  ensureDirectory(destination);

  for (var i = 0; i < files.length; i++) {
    fs.copyFileSync(path.join(source, files[i]), path.join(destination, files[i]));
  }
}

function parseOrderedName(file) {
  var base = file.replace(/\.png$/i, '');
  var match = base.match(/^\d+_([0-9A-F-]+)_(.+)$/i);

  if (!match) {
    return { name: base.replace(/[_-]+/g, ' '), code: base };
  }

  return {
    name: match[2].replace(/-/g, ' '),
    code: match[1]
  };
}

function parseExtraName(file) {
  var base = file.replace(/\.png$/i, '');
  var parts = base.split('_');
  var code = parts.slice(2).join('-') || parts.slice(1).join('-') || base;
  return { name: 'Extra ' + code, code: code };
}

if (!fs.existsSync(allSource) || !fs.existsSync(extrasSource) || !fs.existsSync(categoriesSource)) {
  throw new Error('Emoji source is incomplete: ' + sourceRoot);
}

var categoryDirectories = fs.readdirSync(categoriesSource, { withFileTypes: true })
  .filter(function (entry) { return entry.isDirectory(); })
  .map(function (entry) { return entry.name; })
  .sort();
var categoryByFile = {};
var categories = [];

for (var categoryIndex = 0; categoryIndex < categoryDirectories.length; categoryIndex++) {
  var directoryName = categoryDirectories[categoryIndex];
  var categoryId = directoryName.replace(/^\d+_/, '').replace(/_&_/g, '-').replace(/_/g, '-').toLowerCase();
  var filesInCategory = [];
  walkPngFiles(path.join(categoriesSource, directoryName), filesInCategory);

  for (var categoryFileIndex = 0; categoryFileIndex < filesInCategory.length; categoryFileIndex++) {
    categoryByFile[filesInCategory[categoryFileIndex]] = categoryId;
  }

  categories.push({ id: categoryId, label: categoryLabels[directoryName] || directoryName.replace(/^\d+_/, '').replace(/_/g, ' ') });
}

categories.push({ id: 'extras', label: 'Extras' });

var allFiles = pngFiles(allSource);
var extraFiles = pngFiles(extrasSource);
copyFiles(allFiles, allSource, allDestination);
copyFiles(extraFiles, extrasSource, extrasDestination);

var emoji = [];

for (var allIndex = 0; allIndex < allFiles.length; allIndex++) {
  var allFile = allFiles[allIndex];
  var allName = parseOrderedName(allFile);
  emoji.push([allFile, allName.name, categoryByFile[allFile] || 'extras', allName.code, 0]);
}

for (var extraIndex = 0; extraIndex < extraFiles.length; extraIndex++) {
  var extraFile = extraFiles[extraIndex];
  var extraName = parseExtraName(extraFile);
  emoji.push([extraFile, extraName.name, 'extras', extraName.code, 1]);
}

ensureDirectory(destinationRoot);
var manifest = {
  version: 1,
  categories: categories,
  emoji: emoji
};
var manifestText = '(function (root) { root.FlowEmojiData = ' + JSON.stringify(manifest) + '; })(window);\n';
fs.writeFileSync(path.join(destinationRoot, 'emoji-manifest.js'), manifestText, 'utf8');

process.stdout.write('Built ' + emoji.length + ' emoji (' + allFiles.length + ' ordered, ' + extraFiles.length + ' extras).\n');
