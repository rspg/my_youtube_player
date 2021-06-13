<template>
  <div class="chat-replay" v-if="this.chatInfo">
    <v-container class="chat-replay-button">
      <v-spacer></v-spacer>
      <v-btn icon @click="switchVisible"><v-icon>mdi-message-text</v-icon></v-btn>
    </v-container>
    <div class="chat-replay-list" :style="listContainerStyle">
      <v-card class="mx-auto" :style="listStyle">
        <v-card-title>チャットリプレイ</v-card-title>
        <v-list class="overflow-y-auto" :height="listHeight" ref="messageList" color="#101010">
          <template v-for="item in frames">
            <template v-for="action in item.actions">
              <v-list-item v-if="isChatText(action)" :key="action.addChatItemAction.item.clientId">
                <v-list-item-avatar size="28px">
                  <v-img :src="iconUrl(action)"></v-img>
                </v-list-item-avatar>
                <div class="chat-item-content">
                  <span class="chat-item-timestamp">{{timestampText(action)}}</span>  
                  <span class="chat-item-author">{{authorName(action)}}</span>  
                  <span>
                    <template v-for="run in messageRuns(action)">
                      {{run.text}}
                    </template>
                  </span>
                </div>
              </v-list-item>
            </template>
          </template>
        </v-list>
      </v-card>
    </div>
  </div>
</template>

<script>
import { ipcRenderer } from 'electron'

function sleep(ms){
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const leftIn = 'translate(0,0)'
const leftOut = 'translate(100%,0)'

export default {
  name: 'ChatReplay',
  data: () =>({
    messages: [],
    frames: [],
    chatInfo: undefined,
    lastTime: 0,
    cancelToken: undefined,
    listHeight: '400px',
    listStyle: { 
      'width':'100%',
      'transition-property': 'transform',
      'transition-duration': '0.2s',
      'transform': 'translate(100%,0)',
    },
    listContainerStyle: {
      'pointer-events': 'none'
    }
  }),
  created(){
    console.log('ChatReplay')
    ipcRenderer.on('video-changed', async (event, arg) => {
      this.messages = [];
      this.frames = [];
      this.lastTime = 0;
      this.chatInfo = undefined;
      this.chatInfo = await ipcRenderer.invoke('get-chat-replay', {id:arg.id});
    })
  },
  mounted() {
    window.addEventListener('resize', ()=>{
        this.fitHeight();
    });
  },
  methods: {
    videoStateChanged(event){
      if(event.data == 1){
        if(this.cancelToken){
          this.cancelToken.value = true;
        }
        this.cancelToken = { value: false };
        this.poll(event.target, this.cancelToken);
      }
    },
    fitHeight(){
      if(this.$refs.messageList != null)
        this.listHeight = window.innerHeight - this.$refs.messageList.$el.getBoundingClientRect().top + 'px';
    },

    async poll(player, cancelToken) {
      let completion = await (async () => {
        for(let i = 0; i < 15; ++i){
          if(this.chatInfo)
            return true;
          await sleep(200);
        }
        return false;
      })();
      if(!completion)
        return;
      
      let query = { }
      let fetch = async (timeOffsetMs) => {
        console.log('message fetching ' + timeOffsetMs);
        query.result = undefined;
        let result = await ipcRenderer.invoke('get-chat-messages', { 
            apiKey:this.chatInfo.apiKey, 
            continuation:this.chatInfo.continuation, 
            timeOffsetMs });
        query.messages = result.messages;
      }

      let isPlaying = ()=> { return player.getPlayerState()==1; }
      let nowMS = () => { return Math.floor(player.getCurrentTime()*1000); }
      let throwIfcancelled = () => { if(cancelToken.value) throw "cancelled"; }

      await fetch(nowMS());
      
      let messages = query.messages;
      try{
        while(isPlaying() && !cancelToken.value){
          let fetchTask = fetch(
            (messages && messages.length) ? messages[messages.length - 1].replayChatItemAction.videoOffsetTimeMsec : 0);

          for(let i in messages){
            let time = nowMS();
            let offsetMs = messages[i].replayChatItemAction.videoOffsetTimeMsec;
            if(time < offsetMs){
              await sleep(offsetMs - time)
            }

            throwIfcancelled();
            if(!isPlaying()) return;

            if(this.frames.length > 50)
              this.frames.shift();
            this.frames.push(messages[i].replayChatItemAction);
          }

          await fetchTask
          messages = query.messages
        }
      }
      catch(e){
        console.log(e);
      }
    },

    setVisible(value){
      if(value){
        this.fitHeight();
        this.$refs.messageList.$el.scrollIntoView(false);
        this.$refs.messageList.$el.scrollTo(0, 10000);
        this.listStyle.transform = leftIn
        this.listContainerStyle['pointer-events'] = 'auto';
      }
      else{
        this.listStyle.transform = leftOut
        this.listContainerStyle['pointer-events'] = 'none';
      }
    },
    switchVisible(){
      this.setVisible(this.listStyle.transform != leftIn);
    },

    isChatText(action){
       return action && action.addChatItemAction && action.addChatItemAction.item && action.addChatItemAction.item.liveChatTextMessageRenderer
    },
    iconUrl(action){
      return action.addChatItemAction.item.liveChatTextMessageRenderer.authorPhoto.thumbnails[0].url;
    },
    messageRuns(action){
      return action.addChatItemAction.item.liveChatTextMessageRenderer.message.runs;
    },
    authorName(action){
      return action.addChatItemAction.item.liveChatTextMessageRenderer.authorName.simpleText;
    },
    timestampText(action){
      return action.addChatItemAction.item.liveChatTextMessageRenderer.timestampText.simpleText;
    },
  }
}
</script>