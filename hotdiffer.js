async function fetchContentFromUrl(project, tag, path) {
    const url = `https://raw.githubusercontent.com/${project}/${tag}${path}`;
    return fetch(url)
        .then(response => {
            if (response.status === 200) {
                return response.text();
            } else {
                throw new Error(`HTTP ${response.status} from ${url}`);
            }
        })
}


function getVersionFromTag(tag) {
    const match = /(stable\/)?jitsi-meet_(\d+)/g.exec(tag);
    if (!match) {
        throw new Error('Unexpect tag format : ' + tag);
    }
    return parseInt(match[2]);
}


function getFilePaths(path, tagOld, tagNew) {
    return [_parsePath(path, tagOld), _parsePath(path, tagNew)];
}


function _parsePath(path, tag) {
    if (typeof path === 'string') {
        return path;
    } else if (tag === 'master') {
        return path.newPath;
    } else {
        return (getVersionFromTag(tag) >= path.movedAtVersion) ? path.newPath : path.oldPath;
    }
}


const _doFetchAndDiff = async ({project, tagOld, tagNew, path}) => {
    const [pathOld, pathNew] = getFilePaths(path, tagOld, tagNew);

    let [content0, content1] = await Promise.all([
        fetchContentFromUrl(project, tagOld, pathOld),
        fetchContentFromUrl(project, tagNew, pathNew),
    ]);

    const diff = (pathOld === pathNew) ?
        Diff.createPatch(pathNew, content0, content1) :
        Diff.createTwoFilesPatch(pathOld, pathNew, content0, content1);

    return {
        // If last line is just the diff header then there is no diff
        changed: (!diff.endsWith(`\n+++ ${pathNew}\n`)) ,
        moved: (pathOld !== pathNew),
        path: pathNew,
        oldPath: pathOld,
        diff: diff,
    }
};


const fetchFilesAndCompare = async ({project, tagOld, tagNew, paths}) => {
    let results = await Promise.all(paths.map(path => _doFetchAndDiff({project, tagOld, tagNew, path})));

    let unchanged = [];
    let combinedDiff = '';

    $.map(results, function(result) {
        if (!result.changed && !result.moved) {
            unchanged.push(result.path);
        } else {
            combinedDiff += result.diff + '\n';
        }
    })

    return {
        diff: combinedDiff,
        unchanged: unchanged,
    }
}


function randomIdent() {
    return (Math.random() + 1).toString(36).substring(7);
}