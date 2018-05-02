const _ = require('lodash');
const {
  promisify
} = require('es6-promisify');
const path = require('path');
const fs = require('fs');
const del = require('del');
const mkdirp = promisify(require('mkdirp'));

const writeFile = promisify(fs.writeFile);

const buildCases = async (baseDir, groupName, divLen, divCount, options, grep) => {
  const fromTos = [];
  for (let i = 0; i < divCount - 1; i++) {
    const from = i * divLen;
    const to = from + divLen - 1;
    fromTos.push({
      from,
      to
    });
  }
  fromTos.push({
    from: (divCount - 1) * divLen
  });

  return await Promise.all(fromTos.map(({
    from,
    to
  }, index) => {
    return saveCase(baseDir, `part${index}`, groupName, from, to, options, grep);
  }));
};

const saveCase = async (baseDir, partName, groupName, from, to, options, grep) => {
  await del([baseDir]);
  const preloadJs = path.join(baseDir, partName, 'preload.js');
  const uiautoConfigJs = path.join(baseDir, partName, 'uiauto.config.js');
  await Promise.all([
    saveFile(preloadJs, getPreloadContent(groupName, from, to, grep)),
    saveFile(uiautoConfigJs, getUIAutoConfigContent(preloadJs, options))
  ]);
  return path.join(path.basename(baseDir), partName, 'uiauto.config.js');
};

const saveFile = async (filePath, cnt) => {
  await mkdirp(path.dirname(filePath));
  await writeFile(filePath, cnt, 'utf-8');
};

const getUIAutoConfigContent = (preloadJsPath, options) => {
  _.set(options, 'windowConfig.webPreferences.preload', preloadJsPath);
  return `const path = require('path');
module.exports = ${JSON.stringify(options, null, 4)};`;
};

// TODO timeout to exit container
const getPreloadContent = (groupName, from, to, grep) => {
  return (to === undefined || to === null) ? `window._$test = {
  groupName: '${groupName}',
  from: ${from},
  grep: '${grep}'
};` : `window._$test = {
  groupName: '${groupName}',
  from: ${from},
  to: ${to},
  grep: '${grep}'
};`;
};

module.exports = (config) => {
  return Promise.all(
    config.caseGroups.map(({
      baseDir,
      groupName,
      windowOptions,
      divLen,
      divCount,
      grep
    }) => {
      return buildCases(baseDir, groupName, divLen, divCount, windowOptions, grep);
    })
  ).then((configsList) => {
    return _.flatten(configsList);
  });
};
