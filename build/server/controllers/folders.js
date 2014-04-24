// Generated by CoffeeScript 1.7.1
var CozyInstance, File, Folder, KB, MB, archiver, async, findFolder, getFolderPath, jade, publicfoldertemplate, sharing;

Folder = require('../models/folder');

File = require('../models/file');

CozyInstance = require('../models/cozy_instance');

jade = require('jade');

async = require('async');

sharing = require('../helpers/sharing');

archiver = require('archiver');

publicfoldertemplate = require('path').join(__dirname, '../views/publicfolder.jade');

KB = 1024;

MB = KB * KB;

findFolder = function(id, callback) {
  return Folder.find(id, (function(_this) {
    return function(err, folder) {
      if (err || !folder) {
        return callback("Folder not found");
      } else {
        return callback(null, folder);
      }
    };
  })(this));
};

getFolderPath = function(id, cb) {
  if (id === 'root') {
    return cb(null, "");
  } else {
    return findFolder(id, function(err, folder) {
      if (err) {
        return cb(err);
      } else {
        return cb(null, folder.path + '/' + folder.name);
      }
    });
  }
};

module.exports.create = function(req, res) {
  if ((!req.body.name) || (req.body.name === "")) {
    return res.send({
      error: true,
      msg: "Invalid arguments"
    }, 500);
  } else {
    return Folder.all((function(_this) {
      return function(err, folders) {
        var hasntTheSamePath;
        hasntTheSamePath = function(folder, cb) {
          return cb((req.body.path + '/' + req.body.name) !== (folder.path + '/' + folder.name));
        };
        return async.every(folders, hasntTheSamePath, function(available) {
          if (!available) {
            return res.send({
              error: true,
              msg: "This folder already exists"
            }, 400);
          } else {
            return Folder.all((function(_this) {
              return function(err, folders) {
                var fullPath, parent, parents;
                if (err) {
                  return callback(err);
                }
                fullPath = req.body.path;
                parents = folders.filter(function(tested) {
                  return fullPath === tested.getFullPath();
                });
                if (parents.length) {
                  parent = parents[0];
                  req.body.tags = parent.tags;
                } else {
                  req.body.tags = [];
                }
                return Folder.create(req.body, function(err, newFolder) {
                  if (err) {
                    return res.send({
                      error: true,
                      msg: "Server error while creating file: " + err
                    }, 500);
                  } else {
                    return newFolder.index(["name"], function(err) {
                      if (err) {
                        console.log(err);
                        return res.send({
                          error: true,
                          msg: "Couldn't index: : " + err
                        }, 500);
                      } else {
                        return res.send(newFolder, 200);
                      }
                    });
                  }
                });
              };
            })(this));
          }
        });
      };
    })(this));
  }
};

module.exports.find = function(req, res) {
  return findFolder(req.params.id, function(err, folder) {
    if (err) {
      return res.send({
        error: true,
        msg: err
      }, 404);
    } else {
      return res.send(folder, 200);
    }
  });
};

module.exports.tree = function(req, res) {
  return findFolder(req.params.id, function(err, folderChild) {
    if (err) {
      return res.send({
        error: true,
        msg: "Server error occured: " + err
      }, 500);
    } else {
      return Folder.all((function(_this) {
        return function(err, folders) {
          var isParent;
          isParent = function(folder, cb) {
            if ((folderChild.path + "/").indexOf(folder.path + "/" + folder.name + "/") === 0) {
              return cb(null, [folder]);
            } else {
              return cb(null, []);
            }
          };
          return async.concat(folders, isParent, function(err, parents) {
            if (err) {
              return res.send({
                error: true,
                msg: "Couldn't find the tree: : " + err
              }, 500);
            } else {
              parents = parents.sort(function(a, b) {
                if (a.path + "/" + a.name < b.path + "/" + b.name) {
                  return -1;
                } else {
                  return 1;
                }
              });
              return res.send(parents, 200);
            }
          });
        };
      })(this));
    }
  });
};

module.exports.modify = function(req, res) {
  if ((req.body.name == null) && (req.body["public"] == null)) {
    return res.send({
      error: true,
      msg: "Data required"
    }, 400);
  }
  return findFolder(req.params.id, function(err, folderToModify) {
    var hasntTheSamePathOrIsTheSame, isPublic, newName, newPath, newTags, oldPath, updateFoldersAndFiles, updateIfIsSubFolder, updateTheFolder;
    if (err) {
      return next(err);
    }
    newName = req.body.name;
    isPublic = req.body["public"];
    oldPath = folderToModify.path + '/' + folderToModify.name + "/";
    newPath = folderToModify.path + '/' + newName + "/";
    newTags = req.body.tags || [];
    newTags = newTags.filter(function(e) {
      return typeof e === 'string';
    });
    hasntTheSamePathOrIsTheSame = function(folder, cb) {
      if (folderToModify.id === folder.id) {
        return cb(true);
      } else {
        return cb(newPath !== (folder.path + '/' + folder.name + "/"));
      }
    };
    updateIfIsSubFolder = function(file, cb) {
      var modifiedPath, newRealPath, oldRealPath, oldTags, tag, tags, _i, _len;
      if ((file.path + "/").indexOf(oldPath) === 0) {
        oldRealPath = folderToModify.path + '/' + folderToModify.name;
        newRealPath = folderToModify.path + '/' + newName;
        modifiedPath = file.path.replace(oldRealPath, newRealPath);
        oldTags = file.tags;
        tags = [].concat(oldTags);
        for (_i = 0, _len = newTags.length; _i < _len; _i++) {
          tag = newTags[_i];
          if (tags.indexOf(tag === -1)) {
            tags.push(tag);
          }
        }
        return file.updateAttributes({
          path: modifiedPath,
          tags: tags
        }, cb);
      } else {
        return cb(null);
      }
    };
    updateTheFolder = function() {
      var data;
      data = {
        name: newName,
        "public": isPublic,
        tags: newTags
      };
      if (req.body.clearance) {
        data.clearance = req.body.clearance;
      }
      return folderToModify.updateAttributes(data, (function(_this) {
        return function(err) {
          if (err) {
            return next(err);
          }
          return folderToModify.index(["name"], function(err) {
            if (err) {
              return res.send({
                error: true,
                msg: "Couldn't index: " + err
              }, 500);
            } else {
              return res.send({
                success: 'File succesfuly modified'
              }, 200);
            }
          });
        };
      })(this));
    };
    updateFoldersAndFiles = function(folders) {
      return async.each(folders, updateIfIsSubFolder, function(err) {
        if (err) {
          return res.send({
            error: true,
            msg: "Error updating folders: " + err
          }, 500);
        } else {
          return File.all((function(_this) {
            return function(err, files) {
              if (err) {
                return res.send({
                  error: true,
                  msg: "Server error occured: " + err
                }, 500);
              } else {
                return async.each(files, updateIfIsSubFolder, function(err) {
                  if (err) {
                    return res.send({
                      error: true,
                      msg: "Error updating files: " + err
                    }, 500);
                  } else {
                    return updateTheFolder();
                  }
                });
              }
            };
          })(this));
        }
      });
    };
    return Folder.all((function(_this) {
      return function(err, folders) {
        if (err) {
          return res.send({
            error: true,
            msg: "Server error occured: " + err
          }, 500);
        } else {
          return async.every(folders, hasntTheSamePathOrIsTheSame, function(available) {
            if (!available) {
              return res.send({
                error: true,
                msg: "The name already in use"
              }, 400);
            } else {
              return updateFoldersAndFiles(folders);
            }
          });
        }
      };
    })(this));
  });
};

module.exports.destroy = function(req, res) {
  return findFolder(req.params.id, function(err, currentFolder) {
    var destroyIfIsSubdirectory, directory;
    if (err) {
      return res.send({
        error: true,
        msg: err
      }, 404);
    } else {
      directory = currentFolder.path + '/' + currentFolder.name;
      destroyIfIsSubdirectory = function(file, cb) {
        if (file.path.indexOf(directory) === 0) {
          if (file.binary) {
            return file.removeBinary("file", function(err) {
              if (err) {
                return cb(err);
              } else {
                return file.destroy(cb);
              }
            });
          } else {
            return file.destroy(cb);
          }
        } else {
          return cb(null);
        }
      };
      return Folder.all((function(_this) {
        return function(err, folders) {
          if (err) {
            return res.send({
              error: true,
              msg: "Server error occured: " + err
            }, 500);
          } else {
            return async.each(folders, destroyIfIsSubdirectory, function(err) {
              if (err) {
                return res.send({
                  error: true,
                  msg: "Server error occured while deleting subdirectories: " + err
                }, 500);
              } else {
                return File.all((function(_this) {
                  return function(err, files) {
                    if (err) {
                      return res.send({
                        error: true,
                        msg: "Server error occured: " + err
                      }, 500);
                    } else {
                      return async.each(files, destroyIfIsSubdirectory, function(err) {
                        if (err) {
                          return res.send({
                            error: true,
                            msg: "Server error occured when deleting sub files: " + err
                          }, 500);
                        } else {
                          return currentFolder.destroy(function(err) {
                            if (err) {
                              return res.send({
                                error: "Cannot destroy folder: " + err
                              }, 500);
                            } else {
                              return res.send({
                                success: "Folder succesfuly deleted: " + err
                              }, 200);
                            }
                          });
                        }
                      });
                    }
                  };
                })(this));
              }
            });
          }
        };
      })(this));
    }
  });
};

module.exports.findFiles = function(req, res) {
  return getFolderPath(req.body.id, function(err, key) {
    if (err) {
      return res.send({
        error: true,
        msg: "Server error occured: " + err
      }, 500);
    } else {
      return File.byFolder({
        key: key
      }, function(err, files) {
        if (err) {
          return res.send({
            error: true,
            msg: "Server error occured: " + err
          }, 500);
        } else {
          return res.send(files, 200);
        }
      });
    }
  });
};

module.exports.findFolders = function(req, res) {
  return getFolderPath(req.body.id, function(err, key) {
    if (err) {
      return res.send({
        error: true,
        msg: "Server error occured: " + err
      }, 500);
    } else {
      return Folder.byFolder({
        key: key
      }, function(err, files) {
        if (err) {
          return res.send({
            error: true,
            msg: "Server error occured: " + err
          }, 500);
        } else {
          return res.send(files, 200);
        }
      });
    }
  });
};

module.exports.search = function(req, res) {
  var parts, query, sendResults, tag;
  sendResults = function(err, files) {
    if (err) {
      return res.send({
        error: true,
        msg: err
      }, 500);
    } else {
      return res.send(files);
    }
  };
  query = req.body.id;
  query = query.trim();
  if (query.indexOf('tag:') !== -1) {
    parts = query.split();
    parts = parts.filter(function(e) {
      return e.indexOf('tag:' !== -1);
    });
    tag = parts[0].split('tag:')[1];
    return Folder.request('byTag', {
      key: tag
    }, sendResults);
  } else {
    return Folder.search("*" + query + "*", sendResults);
  }
};

module.exports.zip = function(req, res) {
  return getFolderPath(req.params.id, function(err, key) {
    if (err) {
      return res.send({
        error: true,
        msg: "Server error occured: " + err
      }, 500);
    } else {
      return File.all(function(err, files) {
        if (err) {
          return res.send({
            error: true,
            msg: "Server error occured: " + err
          }, 500);
        } else {
          return findFolder(req.params.id, function(err, folder) {
            var isContained, zipName, _ref;
            if (err || !folder) {
              return res.send(404);
            } else {
              zipName = (_ref = folder.name) != null ? _ref.replace(/\W/g, '') : void 0;
              isContained = function(file, cb) {
                if ((file.path + "/").indexOf(key + "/") === 0) {
                  return cb(null, [file]);
                } else {
                  return cb(null, []);
                }
              };
              return async.concat(files, isContained, function(err, files) {
                var addToArchive, archive;
                if (err) {
                  return res.send({
                    error: true,
                    msg: "Server error"
                  }, 400);
                } else {
                  archive = archiver('zip');
                  addToArchive = function(file, cb) {
                    var name, stream;
                    stream = file.getBinary("file", (function(_this) {
                      return function(err, resp, body) {
                        if (err) {
                          return res.send({
                            error: true,
                            msg: "Server error occured: " + err
                          }, 500);
                        }
                      };
                    })(this));
                    name = file.path.replace(key, "") + "/" + file.name;
                    return archive.append(stream, {
                      name: name
                    }, cb);
                  };
                  async.eachSeries(files, addToArchive, function(err) {
                    var disposition;
                    if (err) {
                      return res.send({
                        error: true,
                        msg: "Server error occured: " + err
                      }, 500);
                    } else {
                      archive.pipe(res);
                      disposition = "attachment; filename=\"" + zipName + ".zip\"";
                      res.setHeader('Content-Disposition', disposition);
                      return res.setHeader('Content-Type', 'application/zip');
                    }
                  });
                  return archive.finalize(function(err, bytes) {
                    if (err) {
                      return res.send({
                        error: true,
                        msg: "Server error occured: " + err
                      }, 500);
                    } else {
                      return console.log("Zip created");
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
  });
};

module.exports.publicList = function(req, res) {
  var errortemplate;
  errortemplate = function(err) {
    console.log(err);
    return res.send(err.stack || err);
  };
  return findFolder(req.params.id, function(err, folder) {
    if (err) {
      return errortemplate(err);
    }
    return sharing.limitedTree(folder, req, function(path, rule) {
      var authorized, key;
      authorized = path.length !== 0;
      if (!authorized) {
        return res.send(404);
      }
      key = folder.path + '/' + folder.name;
      return async.parallel([
        function(cb) {
          return CozyInstance.getLocale(cb);
        }, function(cb) {
          return Folder.byFolder({
            key: key
          }, cb);
        }, function(cb) {
          return File.byFolder({
            key: key
          }, cb);
        }
      ], function(err, results) {
        var e, files, folders, html, lang, locals, translate, translations;
        if (err) {
          return errortemplate(err);
        }
        lang = results[0], folders = results[1], files = results[2];
        translations = (function() {
          try {
            return require('../../client/app/locales/' + lang);
          } catch (_error) {
            e = _error;
            try {
              return require('../../../client/app/locales/' + lang);
            } catch (_error) {
              e = _error;
              return {};
            }
          }
        })();
        translate = function(text) {
          return translations[text] || text;
        };
        files = files.map(function(file) {
          file = file.toJSON();
          file.lastModification = new Date(file.lastModification).toISOString().split('T').join(' ').split('.')[0];
          file.size = file.size > MB ? (parseInt(file.size) / MB).toFixed(1) + translate("MB") : file.size > KB ? (parseInt(file.size) / KB).toFixed(1) + translate("KB") : file.size + translate("B");
          return file;
        });
        locals = {
          path: path,
          files: files,
          folders: folders,
          canupload: rule.perm === 'rw',
          keyquery: "?key=" + req.query.key,
          t: translate
        };
        try {
          html = jade.renderFile(publicfoldertemplate, locals);
          return res.send(html);
        } catch (_error) {
          err = _error;
          return errortemplate(err);
        }
      });
    });
  });
};

module.exports.publicZip = function(req, res) {
  var errortemplate;
  errortemplate = function(err) {
    return res.send(err.stack || err);
  };
  return findFolder(req.params.id, function(err, folder) {
    if (err) {
      return errortemplate(err);
    }
    return sharing.checkClearance(folder, req, function(authorized) {
      if (!authorized) {
        return res.send(404);
      } else {
        return module.exports.zip(req, res);
      }
    });
  });
};

module.exports.publicCreate = function(req, res, next) {
  var toCreate;
  toCreate = new Folder(req.body);
  return sharing.checkClearance(toCreate, req, 'w', function(authorized) {
    if (!authorized) {
      return res.send(401);
    } else {
      return module.exports.create(req, res, next);
    }
  });
};
