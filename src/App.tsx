import React from "react";
import { GiftedChat, IMessage } from "react-web-gifted-chat";
import firebase from "firebase";
import { Dialog, DialogTitle, List, ListItem, ListItemAvatar, Avatar, ListItemText, Button } from '@material-ui/core';
import Typography from "@material-ui/core/Typography";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";

const config = {
  apiKey: "XXXXXXXX",
  authDomain: "XXXXXXXX.firebaseapp.com",
  databaseURL: "https://XXXXXXXX.firebaseio.com",
  projectId: "XXXXXXXX",
  storageBucket: "XXXXXXXX.appspot.com",
  messagingSenderId: "995225200823",
};
if (!firebase.apps.length) {
  firebase.initializeApp(config);
}

interface ChatUser {
  uid: string,
  name: string,
  messages?: object,
  email: string
};

interface ChatMessage {
  fromUid: string,
  toUid: string,
  message: string,
}

interface AppState {
  messages: ChatMessage[],
  user?: ChatUser,
  users: ChatUser[],
  isAuthenticated: boolean,
  selectedUserUid?: string
}

class App extends React.Component<any, AppState> {
  constructor(props:any) {
    super(props);
    this.state = {
      messages: [],
      users: [],
      isAuthenticated: false,
    };
  }

  async signIn() {
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    try {
      await firebase.auth().signInWithPopup(googleProvider);
    } catch (error) {
      console.error(error);
    }
  }

  signOut() {
    firebase.auth().signOut();
  }

  componentDidMount() {
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        const newUser = this.getChatUserByGoogleUser(user);
        this.setState({
          isAuthenticated: true,
          user: newUser
        }, () => {
          this.addUser(newUser).then(() => {
            this.loadUsers();
            this.loadMessages();
          });
        });
      } else {
        this.setState({ isAuthenticated: false, user: undefined, messages: [] });
      }
    });
  }

  loadMessages = () => {
    new Promise((resolve, reject) => {
      const currUser = this.state.user;
      const selectedUserUid = this.state.selectedUserUid;
      if (currUser && selectedUserUid) {
        firebase
          .database()
          .ref("/messages/")
          .on('value', dataSnapshot => {
            let allMessages: ChatMessage[] = [];
            const messages: ChatMessage[] = dataSnapshot.val() ? Object.values(dataSnapshot.val()) : [];
            messages.filter((message: ChatMessage):boolean => {
              if (
                (message.fromUid === selectedUserUid && message.toUid === currUser.uid) ||
                (message.fromUid === currUser.uid && message.toUid === selectedUserUid)
              ) {
                allMessages.push(message);
                return true;
              }
              return false;
            });
            this.setState({ messages: allMessages }, () => {
              resolve();
            });
          })
      } else {
        reject();
      }
    })
  }

  hasAnUser = (users: ChatUser[], currUser: ChatUser) => {
    return users.filter((user: ChatUser) => user.uid === currUser.uid).length > 0;
  }

  loadUsers = () => {
    return new Promise((resolve: Function, reject: Function) => {
      const callback = (snap: any) => {
        const currUsers = this.state.users;
        const loadedUser: ChatUser = snap.val();
        loadedUser.name = loadedUser.name ? loadedUser.name : "Nome " + currUsers.length;
        const currUser = this.state.user;
        if (currUser && !this.hasAnUser(currUsers, loadedUser) && loadedUser.uid !== currUser.uid) {
          this.setState({
            users: [
              ...currUsers,
              loadedUser
            ]
          })
        } else {

        }
      };
      firebase
        .database()
        .ref("/users/")
        .on("child_added", callback);
    });
  }

  getChatUserByGoogleUser = (googleUser: any): ChatUser => {
    return {
      name: googleUser.displayName,
      uid: googleUser.uid,
      email: googleUser.email
    }
  }

  addUser = (user: ChatUser) => {
    return new Promise((resolve: Function, reject: Function) => {
      firebase
        .database()
        .ref("/users/" + user.uid)
        .set(user)
        .then(function() {
          resolve()
        })
        .catch(function(error) {
          console.error("Error saving message to Database:", error);
        });
      })
  }

  renderPopup() {
    return (
      <Dialog open={!this.state.isAuthenticated}>
        <DialogTitle id="simple-dialog-title">Sign in</DialogTitle>
        <div>
          <List>
            <ListItem button onClick={() => this.signIn()}>
              <ListItemAvatar>
                <Avatar style={{ backgroundColor: "#eee" }}>
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg"
                    height="30"
                    alt="G"
                  />
                </Avatar>
              </ListItemAvatar>
              <ListItemText primary="Sign in with Google" />
            </ListItem>
          </List>
        </div>
      </Dialog>
    );
  }

  onSend(messages: IMessage[]) {
    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const { user, selectedUserUid } = this.state;
      if (user && selectedUserUid) {
        const chatMessage: ChatMessage = {
          fromUid: user.uid,
          toUid: selectedUserUid,
          message: lastMessage.text
        };
        this.saveMessage(chatMessage);
      }
    }
  }

  saveMessage(message: ChatMessage) {
    return firebase
      .database()
      .ref("/messages/")
      .push(message)
      .catch(function(error) {
        console.error("Error saving message to Database:", error);
      });
  }

  renderSignOutButton() {
    if (this.state.isAuthenticated) {
      return <Button onClick={() => this.signOut()}>Sign out</Button>;
    }
    return null;
  }

  renderChat() {
    const { user, selectedUserUid } = this.state;
    return user && selectedUserUid ? (
      <GiftedChat
        user={{
          id: user.uid,
        }}
        messages={this.state.messages.map((message: ChatMessage, index: number): IMessage => {
          return {
            id: index,
            text: message.message,
            createdAt: new Date(),
            user: {
              id: message.fromUid
            }
          }
        }).slice().reverse()}
        onSend={messages => this.onSend(messages)}
      />
    ) : null;
  }

  selectUser = (uid: string) => {
    this.setState({
      selectedUserUid: uid,
      messages: []
    }, () => {
      this.loadMessages();
    })
  }

  renderChannels() {
    return (
      <List>
        {
          this.state.users.map((user: ChatUser) => {
            return (
              <ListItem button onClick={() => this.selectUser(user.uid)}>
                <ListItemAvatar>
                  <Avatar>{
                    user.name.substr(0, 1).toUpperCase()
                  }</Avatar>
                </ListItemAvatar>
                <ListItemText primary={user.name} secondary={user.email} />
              </ListItem>
            )
          })
        }
      </List>
    );
  }

  renderChannelsHeader() {
    return (
      <AppBar position="static" color="default">
        <Toolbar>
          <Typography variant="h6" color="inherit">
            Users
          </Typography>
        </Toolbar>
      </AppBar>
    );
  }
  renderChatHeader() {
    return (
      <AppBar position="static" color="default">
        <Toolbar>
          <Typography variant="h6" color="inherit">
            Default channel
          </Typography>
        </Toolbar>
      </AppBar>
    );
  }
  renderSettingsHeader() {
    return (
      <AppBar position="static" color="default">
        <Toolbar>
          <Typography variant="h6" color="inherit">
            Settings
          </Typography>
        </Toolbar>
      </AppBar>
    );
  }

  render() {
    return (
      <div style={styles.container}>
        {this.renderPopup()}
        <div style={styles.channelList}>
          {this.renderChannelsHeader()}
          {this.renderChannels()}
        </div>
        <div style={styles.chat}>
          {this.renderChatHeader()}
          {this.renderChat()}
        </div>
        <div style={styles.settings}>
          {this.renderSettingsHeader()}
          {this.renderSignOutButton()}
        </div>
      </div>
    );
  }
}

const containerStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "row",
  height: "100vh",
}

const channelListStyle: React.CSSProperties = {
  display: "flex",
  flex: 1,
  flexDirection: "column",
};

const chatStyle: React.CSSProperties = {
  display: "flex",
  flex: 3,
  flexDirection: "column",
  borderWidth: "1px",
  borderColor: "#ccc",
  borderRightStyle: "solid",
  borderLeftStyle: "solid",
};

const settingsStyle: React.CSSProperties = {
  display: "flex",
  flex: 1,
  flexDirection: "column",
};

const styles = {
  container: containerStyle,
  channelList: channelListStyle,
  chat: chatStyle,
  settings: settingsStyle,
};

export default App;
