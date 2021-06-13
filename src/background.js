'use strict'

import { app, protocol, BrowserWindow, ipcMain, shell } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'
import {google} from 'googleapis'
import axios from 'axios';
const htmlparser2 = require('htmlparser2');
const isDevelopment = process.env.NODE_ENV !== 'production'

var youtube = google.youtube({
  version: "v3",
  auth: "<<your authorize key>>"
});

var mainWindow;

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
])

async function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    backgroundColor: '#181818',
    frame: process.env.NODE_ENV !== 'production',
    webPreferences: {
      
      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION
    }
  })

  win.webContents.on('new-window', (event, url)=>{
    event.preventDefault();
    shell.openExternal(url);
  });

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    if (!process.env.IS_TEST) win.webContents.openDevTools()
  } else {
    createProtocol('app')
    // Load the index.html when not in development
    win.loadURL('app://./index.html')
  }

  mainWindow = win;
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS_DEVTOOLS)
    } catch (e) {
      console.error('Vue Devtools failed to install:', e.toString())
    }
  }
  createWindow()
})

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
  }
}

/////////////////////////////////////////////////////////////////////
//  IPC Function

import path from 'path';
import yaml from 'js-yaml'
import * as fs from 'fs/promises';


var context = {
  selectedPlaylistKey: null,
  selectedPlaylist : {},
  currentIndex : 0,
  playlists: [],
};

const playlistDir = path.join(app.getPath('userData'), 'playlist');


async function getPlaylists()
{
  let list = [];

  let files = await fs.readdir(playlistDir);    
  for (const file of files)
  {
    if(path.extname(file) == ".yaml")
    {
      try {
        let fullpath = path.join(playlistDir, file);
        let stat = await fs.stat(fullpath);

        let item = context.playlists.find(x => x.key == file) || {};
        if(item.mtimeMs != stat.mtimeMs){
          let parsed = yaml.load(await fs.readFile(fullpath, {encoding:'utf8'}));
          item = {
            key: file,
            title: parsed.title || '',
            icon: parsed.icon || '',
            mtimeMs: stat.mtimeMs
          };
        }
        list.push(item);
      }
      catch(e) {
        console.log(e.toString());
      }
    } 
  }

  context.playlists = list;

  return context.playlists;
}

function convertVideoInfoItem(videoId, snippet)
{
  return {
    id: videoId,
    title: snippet.title,
    thumbnail: snippet.thumbnails.default.url,
    channel: snippet.channelTitle,
    date: new Date(snippet.publishedAt),
  };
}

async function getVideoInfo(ids, detailed)
{
  let request = async (idlist) => {
    return await new Promise((resolve, reject) => {
      let param = {
        part: 'id,snippet',
        id: idlist.join(','),
        maxResults: idlist.length
      };
      if(detailed)
        param.part += ',statistics';
      youtube.videos.list(param, (err, res) => {
        if(err)
          reject(err);
        else {
          let result = res.data.items.map(x => {
            let y = convertVideoInfoItem(x.id, x.snippet)
            if(detailed){
              y.description = x.snippet.description;
              y.statistics = x.statistics;
            }
            return y;
          });
          
          resolve(result);
        }
      });
    });
  };

  let resultAll = [];
  let idsPart = [];
  for(let i in ids){
    idsPart.push(ids[i]);
    if(idsPart.length >= 50){
      resultAll = resultAll.concat(await request(idsPart));
      idsPart = [];
    }
  }
  if(idsPart.length > 0){
    resultAll = resultAll.concat(await request(idsPart))
  }
  
  return resultAll;
}

async function getChatReplayInfo(videoId)
{
  let url = "https://www.youtube.com/watch?v=" + videoId;

  let patternApiKey = /\"INNERTUBE_API_KEY\"[ \t]*:[ \t]*\"([a-z,A-Z,0-9,_\-]+)\"/;
  let patternLiveChatRenderer = /\"liveChatRenderer\".*/;
  let patternContinuation = /\"continuation\"[ \t]*:[ \t]*\"([a-z,A-Z,0-9,_\-%&$#]+)\"/

  let apiKey;
  let continuation;
  let parser = new htmlparser2.Parser({
    onopentag(name, attributes){
      if(name == 'script')
        this.isscript = true;
    },
    ontext(text){
      if(this.isscript){
        if(!apiKey){
          let apiKeyMatch = text.match(patternApiKey);
          if(apiKeyMatch && apiKeyMatch.length >= 2){
            apiKey = apiKeyMatch[1];
          }
        }
        if(!continuation){
          let liveChatRendererMatch = text.match(patternLiveChatRenderer);
          if(liveChatRendererMatch){
            let partStr = liveChatRendererMatch[0].substring(0, 1024);
            let continuationMatch = partStr.match(patternContinuation);
            if(continuationMatch && continuationMatch.length >= 2) {
              continuation = continuationMatch[1];
            }
          }
        }
      }
    },
    onclosetag(tagname){
      if(tagname == 'script')
        this.isscript = false;
    }
  });

  try{
    let content = await axios.get(url)
    if(content.status != 200)
      return undefined;

    parser.write(content.data);
    parser.end();
  }
  catch(e){
    console.log(e);
  }

  if(!apiKey || !continuation)
    return undefined;

  return { apiKey, continuation };
} 

async function getChatMessages(apiKey, continuation, timeOffsetMs)
{
  let requestUrl = "https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay?key=" + apiKey;
  let data = {
    context:{
      client: {
        clientName: "WEB",
        clientVersion: "2.20210623.00.00"
      }
    },
    currentPlayerState: {
      playerOffsetMs: timeOffsetMs || 0
    },
    continuation: continuation
  }

  try{
    let result = await axios.post(requestUrl, data);
    if(result.status != 200){
      return undefined;
    }
    return result.data;
  }
  catch(e){
    console.log(e);
  }
}

async function getPlaylistItems(playlistId, options)
{
  options = options || {};
  if(options.maxResults == null) 
    options.maxResults = 50;

  let promise = new Promise((resolve, reject) => {
    let param = {
        part: "snippet",
        playlistId: playlistId,
        maxResults: options.maxResults
    };
    if(options.pageToken)
      param.pageToken = options.pageToken;

    youtube.playlistItems.list(param, (err, res) => {
      if(err)
        reject(err);
      else if(!res || !res.data)
        reject('no items');
      else {
          let result = { nextPageToken : res.data.nextPageToken, items: [] };
          for(let i = 0; i < res.data.items.length; ++i) {
            result.items.push(res.data.items[i].snippet);
          }
          resolve(result);
      }
    });
  });

  return await promise;
}

async function saveCurrentPlaylist() {
  if(!context.selectedPlaylistKey || !context.selectedPlaylist)
    return;
  let serialized = yaml.dump(context.selectedPlaylist);
  await fs.writeFile(path.join(playlistDir, context.selectedPlaylistKey), serialized);
  console.log("save done");
}

ipcMain.handle('get-playlists', async (event, arg) => {
  console.log('get-playlists');
  return await getPlaylists();
})

ipcMain.handle('select-playlist', (event, arg) => {
  console.log('select-playlist ' + arg.key)
  context.selectedPlaylistKey = arg.key;
  let playlist = context.playlists.find(x => x.key == context.selectedPlaylistKey);
  mainWindow.webContents.send('playlist-changed', playlist);
})

ipcMain.handle('update-playlist', (event, arg) => {
  console.log('update-playlist');
})

ipcMain.handle('select-video', async (event, arg) => {
  console.log('select-video ' + arg.id);

  let items = context.selectedPlaylist.items;
  let index = items.findIndex(x => x.id == arg.id) 
  if(index < 0 || index == undefined)
    return;

  context.currentIndex = index;
  mainWindow.webContents.send('video-changed', { id: items[index].id });
})

ipcMain.on('query-playlist-items', async (event, arg) => {
  console.log('query-playlist-items');
  try{
    context.selectedPlaylist = yaml.load(await fs.readFile(path.join(playlistDir, context.selectedPlaylistKey), {encoding:'utf8'}));
  }
  catch(e){
    console.log(e);
    context.selectedPlaylist = {};
  }

  let items = context.selectedPlaylist.items || [];
  let itemIdSet = new Set(items.map(x => x.id));

  let results = [];
  let dispatchResults = () =>{
    event.reply('notify-playlist-item', { token:arg.token, value:results });
    results = [];
  }
  let pushResult = (x) => {
    results.push(x);
    if(results.length > 50)
      dispatchResults();
  }

  let newAdded = [];

  {
    let playlists = context.selectedPlaylist.playlists;
    if(!playlists && context.selectedPlaylist.playlist)
      playlists = [ context.selectedPlaylist.playlist ];
    if(!playlists)
      playlists = [];

    for(let i in playlists)
    {
      let playlist =  playlists[i];
      let aborted = false;
      let pageToken;

      do {
        console.log('getPlaylistItems ' + pageToken);
        let result = await getPlaylistItems(playlist.id, { maxResults:50, pageToken:pageToken });
        if(result){
          pageToken = result.nextPageToken;
          for(let i in result.items){
            let item = convertVideoInfoItem(
              result.items[i].resourceId.videoId,
              result.items[i]);
            if(itemIdSet.has(item.id)) {
              aborted = true;
              break;
            }
            else {
              newAdded.push(item);
              console.log('new added item ' + item.id);

              pushResult(item);
            }
          }
        }
        else break;
      } while(pageToken && !aborted);
    }
  }

  let incompletes = [];
  let completes = [];
  for(let i in items)
  {
    let item = items[i];
    if(!item
      || !('title' in item)
      || !('thumbnail' in item)
      || !('date' in item)
      || !('channel' in item))
    {
      item.incomplete = true;
      incompletes.push(item);
    }
    else{
      completes.push(item);
    }
  }

  {
    for(let i = 0; i < incompletes.length; i += 50){
      let part = incompletes.slice(i, i + 50);
      let result = await getVideoInfo(part.map(x => x.id));
      for(let i in result) {
        let item = part.find(x => x.id == result[i].id);
        for(let key in result[i])
          item[key] = result[i][key];
        delete item.incomplete
        pushResult(item);
      }
    }
    incompletes = incompletes.filter(x => !('incomplete' in x))
  }

  {
    for(let i in completes)
    {
      let item = completes[i];
      if(!item
        || !('title' in item)
        || !('thumbnail' in item)
        || !('date' in item)
        || !('channel' in item))
      {
        continue;
      }
      pushResult(item);
    }

    if(results.length > 0) 
      dispatchResults();
  }

  event.reply('notify-playlist-item', { token:arg.token, completed:true });
  
  items = newAdded.concat(incompletes, completes);
  //items.sort((a, b) => { return b.date - a.date; });
  context.selectedPlaylist.items = items;

  await saveCurrentPlaylist();
});

ipcMain.handle('set-skip-item', (event, arg) =>{
  console.log('set-skip-item', JSON.stringify(arg))
  let items = context.selectedPlaylist.items || [];
  let item = items.find(x => x.id == arg.id);
  if(item){
    item.skip = arg.value;
  }
  saveCurrentPlaylist();
})

ipcMain.handle('get-video-detail', async (event, arg) => {
  console.log('get-video-detail', arg.id)
  let result = await getVideoInfo([ arg.id ], true);
  return (result.length > 0) ? result[0] : {};
})

ipcMain.handle('get-chat-replay', async (event, arg) => {
  return await getChatReplayInfo(arg.id);
})

ipcMain.handle('get-chat-messages', async (event, arg) => {
  let result = await getChatMessages(arg.apiKey, arg.continuation, arg.timeOffsetMs);
  if(result){
    return { 
      continuation : arg.continuation,
      messages : result.continuationContents.liveChatContinuation.actions
    };
  }
});

ipcMain.on('play-end', (event, arg) => {
  mainWindow.webContents.send('notify-play-end');
});

ipcMain.on('minimize', (event, arg) => {
  console.log('minimize');
  mainWindow.minimize();
});

ipcMain.on('maximize', (event, arg) => {
  console.log('maximize');
  if(mainWindow.isMaximized())
    mainWindow.unmaximize()
  else
    mainWindow.maximize()
});

ipcMain.on('close', (event, arg) => {
  console.log('close');
  app.quit();
});

ipcMain.on('signin', async(event, arg) => {
  const win = new BrowserWindow({
    width: 600,
    height: 800,
    backgroundColor: '#181818',
  })
  win.loadURL('https://www.youtube.com/signin', {userAgent: 'Chrome'});
})




async function test()
{
  let chat = await getChatReplayInfo("Vo8mv-FdEB4");
  let result = await getChatMessages(chat.apiKey, chat.continuation);
  console.log(result);
}
//test();