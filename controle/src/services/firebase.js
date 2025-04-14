import firebase from "firebase/compat/app";
import "firebase/compat/database";
import "firebase/compat/auth"; // Adicione esta linha para autenticação
import "firebase/compat/auth";
import "firebase/compat/database";

const firebaseConfig = {
  apiKey: "AIzaSyAO1MtQfMOU2D6JYG63JgYnaPQEJyrae84",
  authDomain: "barracasdepraia-228c0.firebaseapp.com",
  databaseURL: "https://barracasdepraia-228c0-default-rtdb.firebaseio.com",
  projectId: "barracasdepraia-228c0",
  storageBucket: "barracasdepraia-228c0.firebasestorage.app",
  messagingSenderId: "315629037060",
  appId: "1:315629037060:android:89c18e6e3ad4214b743751",
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
