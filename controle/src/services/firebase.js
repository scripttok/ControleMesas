import firebase from "firebase/compat/app";
import "firebase/compat/database";
import "firebase/compat/auth"; // Adicione esta linha para autenticação
import "firebase/compat/auth";
import "firebase/compat/database";

// const firebaseConfig = {
//   apiKey: "AIzaSyAO1MtQfMOU2D6JYG63JgYnaPQEJyrae84",
//   authDomain: "barracasdepraia-228c0.firebaseapp.com",
//   databaseURL: "https://barracasdepraia-228c0-default-rtdb.firebaseio.com",
//   projectId: "barracasdepraia-228c0",
//   storageBucket: "barracasdepraia-228c0.firebasestorage.app",
//   messagingSenderId: "315629037060",
//   appId: "1:315629037060:android:89c18e6e3ad4214b743751",
// };

// const firebaseConfig = {
//   apiKey: "AIzaSyD0cmNAsBDsecY08PPYYXDdGukEGbYpcRA",
//   authDomain: "barracasdepraia-x.firebaseapp.com",
//   databaseURL: "https://barracasdepraia-x-default-rtdb.firebaseio.com",
//   projectId: "barracasdepraia-x",
//   storageBucket: "barracasdepraia-x.firebasestorage.app",
//   messagingSenderId: "584844051269",
//   appId: "1:584844051269:android:8e91caf4e685a371f5b42c",
// };

// const firebaseConfig = {
//   apiKey: "AIzaSyDpLSlZXOfJCmSVLZwads9EAPENmpy73r8",
//   authDomain: "barracasdepraia-334e2.firebaseapp.com",
//   databaseURL: "https://barracasdepraia-334e2-default-rtdb.firebaseio.com",
//   projectId: "barracasdepraia-228c0",
//   storageBucket: "barracasdepraia-334e2.firebasestorage.app",
//   messagingSenderId: "823906762219",
//   appId: "1:823906762219:android:9dcfd05d545122c6d1edae",
// };

// cesar esse abaixo

const firebaseConfig = {
  apiKey: "AIzaSyCYGbf_f8yL7WXc0qTH2YTpW61l52rrGbs",
  authDomain: "bar-do-cesar.firebaseapp.com",
  databaseURL: "https://bar-do-cesar-default-rtdb.firebaseio.com",
  projectId: "bar-do-cesar",
  storageBucket: "bar-do-cesar.firebasestorage.app",
  messagingSenderId: "525946263891",
  appId: "1:525946263891:android:804c41528d531c2b2c29a6",
};

let db = null;

export const ensureFirebaseInitialized = async () => {
  try {
    if (!firebase.apps.length) {
      ("(NOBRIDGE) LOG Inicializando Firebase...");
      await firebase.initializeApp(firebaseConfig);

      // Autenticação anônima com tratamento melhorado
      try {
        await firebase.auth().signInAnonymously();
        ("(NOBRIDGE) LOG Autenticado anonimamente com sucesso");
      } catch (authError) {
        console.error(
          "(NOBRIDGE) ERROR Falha na autenticação anônima:",
          authError
        );
        throw new Error("Falha na autenticação");
      }

      ("(NOBRIDGE) LOG Firebase inicializado com sucesso");
    }

    // Verifica se há usuário autenticado
    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error("Nenhum usuário autenticado");
    }

    db = firebase.database();
    if (!db) {
      throw new Error("Falha ao obter referência do banco de dados Firebase.");
    }
    return db;
  } catch (error) {
    console.error("(NOBRIDGE) ERROR Erro ao inicializar Firebase:", error);
    throw error;
  }
};

export { db };
