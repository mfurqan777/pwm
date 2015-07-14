/*
 * Password Management Servlets (PWM)
 * http://code.google.com/p/pwm/
 *
 * Copyright (c) 2006-2009 Novell, Inc.
 * Copyright (c) 2009-2015 The PWM Project
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */

"use strict";

var PWM_CONFIG = PWM_CONFIG || {};
var PWM_GLOBAL = PWM_GLOBAL || {};

PWM_CONFIG.lockConfiguration=function() {
    PWM_MAIN.showConfirmDialog({text:PWM_CONFIG.showString('Confirm_LockConfig'),okAction:function(){
        PWM_MAIN.showWaitDialog({loadFunction:function() {
            var url = 'ConfigManager?processAction=lockConfiguration';
            var loadFunction = function(data) {
                if (data['error'] == true) {
                    PWM_MAIN.closeWaitDialog();
                    PWM_MAIN.showDialog({
                        title: PWM_MAIN.showString('Title_Error'),
                        text: data['errorDetail']
                    });
                } else {
                    PWM_CONFIG.waitForRestart();
                }
            };
            PWM_MAIN.ajaxRequest(url,loadFunction);
        }});
    }});
};

PWM_CONFIG.waitForRestart=function(options) {
    PWM_VAR['cancelHeartbeatCheck'] = true;

    options = options === undefined ? {} : options;
    console.log("beginning request to determine application status: ");
    var loadFunction = function(data) {
        try {
            var serverStartTime = data['data']['PWM_GLOBAL']['startupTime'];
            if (serverStartTime != PWM_GLOBAL['startupTime']) {
                console.log("application appears to be restarted, redirecting to context url: ");
                var redirectUrl = 'location' in options ? options['location'] : '/';
                PWM_MAIN.goto(redirectUrl);
                return;
            }
        } catch (e) {
            console.log("can't read current server startupTime, will retry detection (current error: " + e + ")");
        }
        setTimeout(function() {
            PWM_CONFIG.waitForRestart(options)
        }, Math.random() * 3000);
    };
    var errorFunction = function(error) {
        setTimeout(function() {
            PWM_CONFIG.waitForRestart(options)
        }, 3000);
        console.log('Waiting for server restart, unable to contact server: ' + error);
    };
    var url = PWM_GLOBAL['url-restservice'] + "/app-data/client?checkForRestart=true";
    PWM_MAIN.ajaxRequest(url,loadFunction,{errorFunction:errorFunction,method:'GET'});
};

PWM_CONFIG.startNewConfigurationEditor=function(template) {
    PWM_MAIN.showWaitDialog({title:'Loading...',loadFunction:function(){
        require(["dojo"],function(dojo){
            dojo.xhrGet({
                url:"ConfigManager?processAction=setOption&pwmFormID=" + PWM_GLOBAL['pwmFormID'] + "&getTemplate=" + template,
                preventCache: true,
                error: function(errorObj) {
                    PWM_MAIN.showError("error starting configuration editor: " + errorObj);
                },
                load: function() {
                    window.location = "ConfigManager?processAction=editMode&pwmFormID=" + PWM_GLOBAL['pwmFormID'] + '&mode=SETTINGS';
                }
            });
        });
    }});
};

PWM_CONFIG.startConfigurationEditor=function() {
    require(["dojo"],function(dojo){
        if(dojo.isIE <= 8){ // only IE8 and below
            alert('Internet Explorer 8 and below is not able to edit the configuration.  Please use a newer version of Internet Explorer or a different browser.');
            document.forms['cancelEditing'].submit();
        } else {
            PWM_MAIN.goto('/private/config/ConfigEditor');
        }
    });
};


PWM_CONFIG.uploadConfigDialog=function() {
    var uploadOptions = {};
    uploadOptions['url'] = window.location.pathname + '?processAction=uploadConfig';
    uploadOptions['title'] = 'Upload Configuration';
    uploadOptions['nextFunction'] = function() {
        PWM_MAIN.showWaitDialog({title:'Save complete, restarting application...',loadFunction:function(){
            PWM_CONFIG.waitForRestart({location:'/'});
        }});
    };
    PWM_CONFIG.uploadFile(uploadOptions);
};

PWM_CONFIG.uploadLocalDB=function() {
    PWM_MAIN.showConfirmDialog({
        text:PWM_CONFIG.showString('Confirm_UploadLocalDB'),
        okAction:function(){
            var uploadOptions = {};
            uploadOptions['url'] = 'ConfigManager?processAction=importLocalDB';
            uploadOptions['title'] = 'Upload and Import LocalDB Archive';
            uploadOptions['nextFunction'] = function() {
                PWM_MAIN.showWaitDialog({title:'Save complete, restarting application...',loadFunction:function(){
                    PWM_CONFIG.waitForRestart({location:'/'});
                }});
            };
            PWM_MAIN.IdleTimeoutHandler.cancelCountDownTimer();
            PWM_CONFIG.uploadFile(uploadOptions);
        }
    });
};

PWM_CONFIG.closeHeaderWarningPanel = function() {
    console.log('action closeHeader');
    PWM_MAIN.setStyle('header-warning','display','none');
    PWM_MAIN.setStyle('button-openHeader','display','inherit');
    var prefs = PWM_MAIN.readLocalStorage();
    prefs['headerVisibility'] = 'hide';
    PWM_MAIN.writeLocalStorage(prefs);
};

PWM_CONFIG.openHeaderWarningPanel = function() {
    console.log('action openHeader');
    PWM_MAIN.setStyle('header-warning','display','inherit');
    PWM_MAIN.setStyle('button-openHeader','display','none');
    var prefs = PWM_MAIN.readLocalStorage();
    prefs['headerVisibility'] = 'show';
    PWM_MAIN.writeLocalStorage(prefs);
};



PWM_CONFIG.showString=function (key, options) {
    options = options === undefined ? {} : options;
    options['bundle'] = 'Config';
    return PWM_MAIN.showString(key,options);

};

PWM_CONFIG.openLogViewer=function(level) {
    var windowUrl = PWM_GLOBAL['url-context'] + '/private/admin/Administration?processAction=viewLogWindow' + ((level) ? '&level=' + level : '');
    var windowName = 'logViewer';
    PWM_MAIN.newWindowOpen(windowUrl,windowName);
};

PWM_CONFIG.showHeaderHealth = function() {
    var refreshUrl = PWM_GLOBAL['url-restservice'] + "/health";
    var parentDiv = PWM_MAIN.getObject('panel-header-healthData');
    if (!parentDiv) {
        return;
    }
    var headerDiv = PWM_MAIN.getObject('header-warning');
    if (parentDiv && headerDiv) {
        var loadFunction = function(data) {
            if (data['data'] && data['data']['records']) {
                var healthRecords = data['data']['records'];
                var hasWarnTopics = false;
                for (var i = 0; i < healthRecords.length; i++) {
                    var healthData = healthRecords[i];
                    if (healthData['status'] == 'WARN') {
                        hasWarnTopics = true;
                    }
                }
                if (hasWarnTopics) {
                    PWM_MAIN.addCssClass('button-openHeader','blink');
                    PWM_MAIN.setStyle('button-openHeader','color','red');

                    parentDiv.innerHTML = '<div id="panel-healthHeaderErrors" class="header-error"><span class="fa fa-warning"></span> ' + PWM_ADMIN.showString('Header_HealthWarningsPresent') + '</div>';
                } else {
                    PWM_MAIN.removeCssClass('button-openHeader','blink');
                    PWM_MAIN.setStyle('button-openHeader','color');
                }
                setTimeout(function () {
                    PWM_CONFIG.showHeaderHealth()
                }, 60 * 1000);
            }
        };
        var errorFunction = function(error) {
            console.log('unable to read header health status: ' + error);
        };
        PWM_MAIN.ajaxRequest(refreshUrl, loadFunction,{errorFunction:errorFunction,method:'GET'});
    }
};

PWM_CONFIG.downloadLocalDB = function () {
    PWM_MAIN.showConfirmDialog({
        text:PWM_CONFIG.showString("Warning_DownloadLocal"),
        okAction:function(){
            PWM_MAIN.showWaitDialog({
                loadFunction:function(){
                    PWM_MAIN.goto('ConfigManager?processAction=exportLocalDB',{addFormID:true,hideDialog:true});
                    setTimeout(function(){PWM_MAIN.closeWaitDialog()},5000);
                }
            });

        }
    });
};

PWM_CONFIG.downloadConfig = function () {
    PWM_MAIN.showConfirmDialog({
        text:PWM_CONFIG.showString("Warning_DownloadConfiguration"),
        okAction:function(){
            PWM_MAIN.showWaitDialog({
                loadFunction:function(){
                    PWM_MAIN.goto('ConfigManager?processAction=downloadConfig',{addFormID:true,hideDialog:true});
                    setTimeout(function(){PWM_MAIN.closeWaitDialog()},5000);
                }
            });

        }
    });
};

PWM_CONFIG.downloadSupportBundle = function() {
    var dialogText = '';
    if (PWM_VAR['config_localDBLogLevel'] != 'TRACE') {
        dialogText += PWM_CONFIG.showString("Warning_MakeSupportZipNoTrace");
        dialogText += '<br/><br/>';
    }
    dialogText += PWM_CONFIG.showString("Warning_DownloadSupportZip");

    PWM_MAIN.showConfirmDialog({
        text:dialogText,
        okAction:function(){
            PWM_MAIN.showWaitDialog({
                loadFunction: function () {
                    PWM_MAIN.goto('ConfigManager?processAction=generateSupportZip', {
                        addFormID: true,
                        hideDialog: true
                    });
                    setTimeout(function () {
                        PWM_MAIN.closeWaitDialog()
                    }, 5000);
                }
            });
        }
    });
};

PWM_CONFIG.uploadFile = function(options) {
    options = options === undefined ? {} : options;

    var body = '<div id="uploadFormWrapper">';
    body += '<div id="fileList"></div>';
    body += '<input style="width:95%" class="btn" name="uploadFile" type="file" label="Select File" id="uploadFile"/>';
    body += '<div class="buttonbar">';
    body += '<button class="btn" type="submit" id="uploadButton" name="Upload"><span class="fa fa-upload"></span> Upload</button>';
    body += '</div></div>';

    var currentUrl = window.location.pathname;
    var uploadUrl = 'url' in options ? options['url'] : currentUrl;
    var title = 'title' in options ? options['title'] : 'Upload File';

    uploadUrl = PWM_MAIN.addPwmFormIDtoURL(uploadUrl);

    var nextFunction = 'nextFunction' in options ? options['nextFunction'] : function(data){
        PWM_MAIN.showDialog({title: PWM_MAIN.showString("Title_Success"), text: data['successMessage'],okAction:function(){
            PWM_MAIN.goto(currentUrl)
        }});
    };


    var completeFunction = function(data){
        if (data['error'] == true) {
            var errorText = 'The file upload has failed.  Please try again or check the server logs for error information.';
            PWM_MAIN.showErrorDialog(data,{text:errorText,okAction:function(){
                location.reload();
            }});
        } else {
            nextFunction(data);
        }
    };

    var errorFunction = function(data) {
        var errorText = 'The file upload has failed.  Please try again or check the server logs for error information.';
        PWM_MAIN.showErrorDialog(data,{text:errorText});
    };

    var progressFunction = function(data) {
        if (data.lengthComputable) {
            var decimal = data.loaded / data.total;
            console.log('upload progress: ' + decimal);
            require(["dijit/registry"],function(registry){
                var progressBar = registry.byId('progressBar');
                if (progressBar) {
                    progressBar.set("maximum", 100);
                    progressBar.set("indeterminate", false);
                    progressBar.set("value", decimal * 100);
                }
                var html5Bar = PWM_MAIN.getObject("wait");
                if (html5Bar) {
                    html5Bar.setAttribute("max", 100);
                    html5Bar.setAttribute("value", decimal * 100);
                }
            });
        } else {
            console.log('progressFunction: no data');
            return;
        }
    };

    var uploadFunction = function() {
        var files = PWM_MAIN.getObject('uploadFile').files;
        if (!files[0]) {
            alert('File not selected');
        }
        var xhr = new XMLHttpRequest();
        var fd = new FormData();
        xhr.onreadystatechange = function() {
            console.log('on ready state change');
            if (xhr.readyState == 4 && xhr.status == 200) {
                // Every thing ok, file uploaded
                console.log(xhr.responseText); // handle response.
                completeFunction(xhr.responseText);
            }
        };
        xhr.upload.addEventListener('progress',progressFunction,false);
        xhr.upload.onprogress = progressFunction;
        xhr.open("POST", uploadUrl, true);
        fd.append("uploadFile", files[0]);
        xhr.send(fd);
        PWM_GLOBAL['inhibitHealthUpdate'] = true;
        PWM_MAIN.IdleTimeoutHandler.cancelCountDownTimer();
        PWM_MAIN.getObject('centerbody').innerHTML = 'Upload in progress...';
        PWM_MAIN.showWaitDialog({title:'Uploading...'});
    };

    completeFunction = 'completeFunction' in options ? options['completeFunction'] : completeFunction;


    require(["dojo"],function(dojo){

        if(dojo.isIE <= 9){ // IE9 and below no workie
            PWM_MAIN.showDialog({title:PWM_MAIN.showString("Title_Error"),text:PWM_CONFIG.showString("Warning_UploadIE9")});
            return;
        }

        PWM_MAIN.showDialog({
            title:title,
            showClose:true,
            showOk:false,
            text:body,
            loadFunction:function(){
                PWM_MAIN.addEventHandler('uploadButton','click',uploadFunction);
            }
        });



        /*
        PWM_MAIN.showWaitDialog({loadFunction:function() {
            console.log('uploading file to url ' + uploadUrl);

            PWM_MAIN.closeWaitDialog();
            var idName = 'dialogPopup';
            PWM_MAIN.clearDijitWidget(idName);
            var theDialog = new Dialog({
                id: idName,
                title: title,
                style: "width: 500px",
                content: body
            });
            theDialog.show();
            var uploader = new dojox.form.Uploader({
                multiple: false,
                name: "uploadFile",
                label: 'Select File',
                required: true,
                url: uploadUrl,
                isDebug: true,
                devMode: true,
                preventCache: true
            }, 'uploadFile');
            uploader.startup();
            var uploadButton = new Button({
                label: 'Upload',
                type: 'submit'
            }, "uploadButton");
            uploadButton.startup();
            new FileList({
                uploaderId: 'uploadFile'
            }, "fileList");
            dojo.connect(uploader, "onComplete", completeFunction);
            dojo.connect(uploader, "onError", errorFunction);
            dojo.connect(uploader, "onBegin", function () {
                PWM_MAIN.clearDijitWidget(idName);
                PWM_MAIN.showWaitDialog({title:"Uploading..."});
            });
            dojo.connect(uploader, "onProgress", function (data) {
                var decimal = data['decimal'];
                require(["dijit/registry"],function(registry){
                    var progressBar = registry.byId('progressBar');
                    if (progressBar) {
                        progressBar.set("maximum", 100);
                        progressBar.set("indeterminate", false);
                        progressBar.set("value", decimal * 100);
                    }
                    var html5Bar = PWM_MAIN.getObject("wait");
                    if (html5Bar) {
                        html5Bar.setAttribute("max",100);
                        html5Bar.setAttribute("value", decimal * 100);
                    }
                });
            });
        }});
        */
    });
};


PWM_CONFIG.heartbeatCheck = function() {
    var heartbeatFrequency = 10 * 1000;
    if (PWM_VAR['cancelHeartbeatCheck']) {
        console.log('heartbeat check cancelled');
        return;
    }
    if (typeof document['hidden'] !== "undefined" && document['hidden']) {
        console.log('skipping heartbeat check because page is not currently visible');
        setTimeout(PWM_CONFIG.heartbeatCheck,heartbeatFrequency);
        return;
    }

    require(["dojo","dijit/Dialog"],function() {
        /* make sure dialog js is loaded, server may not be available to load lazy */
    });

    console.log('beginning config-editor heartbeat check');
    var handleErrorFunction = function(message) {
        console.log('config-editor heartbeat failed');
        PWM_MAIN.showErrorDialog('There has been a problem communicating with the application server, please refresh your browser to continue.<br/><br/>' + message,{
            showOk:false
        });
    };
    var loadFunction = function(data) {
        try {
            var serverStartTime = data['data']['PWM_GLOBAL']['startupTime'];
            if (serverStartTime != PWM_GLOBAL['startupTime']) {
                var message = "Application appears to have be restarted.";
                handleErrorFunction(message);
            } else {
                setTimeout(PWM_CONFIG.heartbeatCheck,heartbeatFrequency);
            }
        } catch (e) {
            handleErrorFunction('Error reading server status.');
        }
    };
    var errorFunction = function(e) {
        handleErrorFunction('I/O error communicating with server.');
    };
    var url = PWM_GLOBAL['url-restservice'] + "/app-data/client?heartbeat=true";
    PWM_MAIN.ajaxRequest(url,loadFunction,{errorFunction:errorFunction,method:'GET'});
};

PWM_CONFIG.initConfigHeader = function() {
    // header initialization
    if (PWM_MAIN.getObject('header_configEditorButton')) {
        PWM_MAIN.addEventHandler('header_configEditorButton', 'click', function () {
            PWM_CONFIG.startConfigurationEditor();
        });
    }
    PWM_MAIN.addEventHandler('header_openLogViewerButton', 'click', function () {
        PWM_CONFIG.openLogViewer(null)
    });
    PWM_MAIN.addEventHandler('panel-header-healthData','click',function(){
        PWM_MAIN.goto('/private/config/ConfigManager');
    });
    PWM_MAIN.addEventHandler('button-closeHeader','click',function(){
        PWM_CONFIG.closeHeaderWarningPanel();
    });
    PWM_MAIN.addEventHandler('button-openHeader','click',function(){
        PWM_CONFIG.openHeaderWarningPanel();
    });

    PWM_CONFIG.showHeaderHealth();

    var prefs = PWM_MAIN.readLocalStorage();
    if (prefs['headerVisibility'] != 'hide') {
        PWM_CONFIG.openHeaderWarningPanel();
    }

    console.log('initConfigHeader completed');
};

PWM_CONFIG.convertListOfIdentitiesToHtml = function(data) {
    var html = '<div style="max-height: 500px; overflow-y: auto">';
    var users = data['users'];
    if (users && !PWM_MAIN.isEmpty(users)) {
        html += '<table style="">';
        html += '<thead><tr><td class="title" style="width: 75px">' + PWM_MAIN.showString('Field_LdapProfile') + '</td>';
        html += '<td class="title" style="max-width: 375px">'+ PWM_MAIN.showString('Field_UserDN') + '</td></tr></thead>';
        html += '<tbody>';
        for (var iter in users) {
            var userIdentity = users[iter];
            html += '<tr ><td style="width: 75px">' + userIdentity['ldapProfile'] + '</td><td title="' + userIdentity['userDN'] + '">';
            html += '<div style="max-width: 375px; white-space: nowrap; overflow:hidden; text-overflow: ellipsis;">' + userIdentity['userDN'] + '</div></td></tr>';
        }
        html += '</tbody></table>';
    } else {
        html += PWM_MAIN.showString('Display_SearchResultsNone');
    }
    html += '</div>';
    if (data['sizeExceeded']) {
        html += '<div class="noticebar">' + PWM_MAIN.showString('Display_SearchResultsExceeded') + '</div>';
    }
    return html;
};
