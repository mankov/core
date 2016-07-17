// # telegram-api
//
//  Functions for interacting with the Telegram's bot API
//
//
// TODO:
//  - use some request-library which uses Promises so we don't
//    need to to this callback nonsense anymore
//
//  - that errorMsg defining which is done n time should be a function

const fs      = require('fs');
const path    = require('path');
const Promise = require('bluebird');
const _       = require('lodash');
const request = require('request');
const stream  = require('stream');
const mime    = require('mime');

const log     = require('./logger');
const cfg     = require('./config');


let botApi = {};

// ## Public functions
//

botApi.getMe = () => new Promise((resolve, reject) => {
  request(`${cfg.tgApiUrl}/getMe`, (err, res, body) => {
    if (!err && JSON.parse(body).ok) {
      resolve(JSON.parse(body).result);
    } else {
      const errorMsg = err
        ? `Telegram API unreachable: ${err}`
        : `Error on getMe: ${JSON.parse(body).description}`;

      log.error(errorMsg);
      reject(errorMsg);
    }
  });
});

// chat_id [int] REQUIRED
// text [string] REQUIRED
// parse_mode ["Markdown" or "HTML"] OPTIONAL
// disable_web_page_preview [boolean] OPTIONAL
// disable_notification [boolean] OPTIONAL
// reply_to_message_id [int] OPTIONAL
// reply_markup [ReplyKeyboardMarkup, ReplyKeyboardHide or ForeReply] OPTIONAL
botApi.sendMessage = (options) => new Promise(resolve => {

  options.hide_keyboard = (_.isUndefined(options.reply_markup));

  // Send the message to Telegram API
  request.post(
    `${cfg.tgApiUrl}/sendMessage`,
    { form: options },
    function messageSendCallback(err, resp, body) {
      if (!err && JSON.parse(body).ok) {
        log.info(`botApi: sending message to ${options.chat_id}: "${_.truncate(options.text)}..."`);
        resolve(body);

      } else {
        const errMsg = (err)
          ? `Telegram API unreachable: ${err}`
          : `Error when sending message: ${JSON.parse(body).description}`;

        log.error(errMsg);
        resolve(errMsg);
      }
    }
  );
});

// chat_id [int or string] REQUIRED
// from_chat_id [int or string] REQUIRED
// disable_notification [boolean] OPTIONAL
// message_id [int] REQUIRED
botApi.forwardMessage = (options) => new Promise(resolve => {
  request.post(
    `${cfg.tgApiUrl}/forwardMessage`,
    { form: options },
    function messageForwardCallback(err, resp, body) {
      if (!err && JSON.parse(body).ok) {
        log.info(`botApi: forwarded message to ${options.chat_id}`);
        resolve(body);

      } else {
        let errorMsg = (err)
          ? `Telegram API unreachable: ${err}`
          : `Error when forwarding message:${JSON.parse(body).description}`;

        log.error(errorMsg);
        resolve(errorMsg);
      }
    }
  );
});

// chat_id [int or string] REQUIRED
// action ['typing' or 'upload_photo' or 'record_video' or
//        'upload_video' or 'record_video' or 'upload_audio' or
//        'upload_document' or 'find_location'] REQUIRED
botApi.sendAction = (options) => {
  request.post(`${cfg.tgApiUrl}/sendChatAction`, { form: options });
};

// chat_id [int or string] REQUIRED
// file [file_location or file_id] REQUIRED
// disable_notification [boolean] OPTIONAL
// reply_to_message_id [int] OPTIONAL
// reply_markup [ReplyKeyboardMarkup or ReplyKeyboardHide or ForceReply] OPTIONAL
botApi.sendSticker = (options) => sendFile('sticker', options);


// chat_id [int or string] REQUIRED
// file [file_location or file_id] REQUIRED
// duration [int] OPTIONAL
// width [int] OPTIONAL
// height [int] OPTIONAL
// caption [string] OPTIONAL
// disable_notification [boolean] OPTIONAL
// reply_to_message_id [int] OPTIONAL
// reply_markup [ReplyKeyboardMarkup or ReplyKeyboardHide or ForceReply] OPTIONAL
botApi.sendVideo = (options) => sendFile('video', options);


// chat_id [int or string] REQUIRED
// file [file_location or file_id] REQUIRED
// caption [string] OPTIONAL
// disable_notification [boolean] OPTIONAL
// reply_to_message_id [int] OPTIONAL
// reply_markup [ReplyKeyboardMarkup or ReplyKeyboardHide or ForceReply] OPTIONAL
botApi.sendPhoto = (options) => sendFile('photo', options);


// url [string] REQUIRED
// certificate [file_location] OPTIONAL
botApi.setWebhook = (options) => new Promise((resolve, reject) => {
  // TODO/NOTE: is deleting the old webhook required? I guess it is since it
  // is done in here, but is it really?

  // Delete old webhook
  let payload = { form: { url: '' } };

  request.post(`${cfg.tgApiUrl}/setWebhook`, payload, (err, response, body) => {
    if (err) {
      log.error(`Telegram API unreachable: ${err}`);
    } else {
      log.debug(`Previous webhook deleted, response: ${body}`);

      // Subscribe new webhook
      let formData = '';
      if (!_.isEmpty(options.certificate)) {
        formData = formatSendData('certificate', options.certificate).formData;
      }

      request.post(
        `${cfg.tgApiUrl}/setWebhook`,
        { qs: options, formData },
        function setWebhookCallback(err, response, body) {
          // TODO we shouldn't be cascading these requests, vars get shadowed etc

          if (!err && JSON.parse(body).ok) {
            log.info('Webhook updated successfully!');
            log.debug(`Webhook response: ${body}`);
            resolve();
          }
          else {
            let errorMsg = (err)
              ? `Telegram API unreachable: ${err}`
              : `Error when setting webhook: ${JSON.parse(body).description}`;

            log.error(errorMsg);
            reject(errorMsg);
          }
        }
      );
    }
  });
});


// file_id [string] REQUIRED
botApi.getFile = (options) => new Promise((resolve, reject) => {
  request.post(
    `${cfg.tgApiUrl}/getFile`,
    { qs: options },
    function getFileCallback(err, response, body) {
      if (!err && JSON.parse(body).ok) {
        resolve(JSON.parse(body).result);
      } else {
        let errmsg = (err)
          ? `Telegram API unreachable: ${err}`
          : `Error when getting file: ${JSON.parse(body).description}`;

        log.error(errmsg);
        reject(errmsg);
      }
    }
  );
});


// ## Internal functions
//

function formatSendData(type, data) {
  let formData = {};
  let fileName;
  let fileId = data;

  if (data instanceof stream.Stream) {
    fileName = path.basename(data.path);

    formData[type] = {
      value: data,
      options: {
        filename: fileName,
        contentType: mime.lookup(fileName)
      }
    };
  }
  else if (fs.existsSync(data)) {
    fileName = path.basename(data);

    formData[type] = {
      value: fs.createReadStream(data),
      options: {
        filename: fileName,
        contentType: mime.lookup(fileName)
      }
    };
  }

  return {
    formData,
    file: fileId
  };
}

function sendFile(type, options) {
  return new Promise((resolve, reject) => {
    let content = formatSendData(type, options.file);
    options[type] = content.file;

    request.post(
      `${cfg.tgApiUrl}/send${_.camelCase(type)}`,
      { qs: options, formData: content.formData },
      function sendFileCallback(err, httpResponse, body) {
        if (!err && JSON.parse(body).ok) {
          log.info(`botApi: sent ${type} to ${options.chat_id}`);
          resolve();
        } else {
          let errorMsg = (err)
            ? `Telegram API unreachable: ${err}`
            : `Error when sending ${type}:  ${JSON.parse(body).description}`;

          log.error(errorMsg);
          reject(errorMsg);
        }
      }
    );
  });
}


module.exports = botApi;
