const fs = require("fs");


jsonWriter = {
    writeFile: (fileName, jsonObject) => {
        fs.writeFile(`./output/${fileName}.json`, JSON.stringify(jsonObject, undefined, 4),
        (err) => {
            if (err) {
                console.error(err);
                return;
            }
            console.log("Successfully created file " + fileName);
        })
    }
}

module.exports = jsonWriter;