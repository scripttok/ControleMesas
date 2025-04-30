import firebase from "firebase/compat/app";
import "firebase/compat/database";
import "firebase/compat/auth";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit,
} from "firebase/firestore";

// const firebaseConfig = {
//   apiKey: "AIzaSyAO1MtQfMOU2D6JYG63JgYnaPQEJyrae84",
//   authDomain: "barracasdepraia-228c0.firebaseapp.com",
//   databaseURL: "https://barracasdepraia-228c0-default-rtdb.firebaseio.com",
//   projectId: "barracasdepraia-228c0",
//   storageBucket: "barracasdepraia-228c0.firebasestorage.app",
//   messagingSenderId: "315629037060",
//   appId: "1:315629037060:android:89c18e6e3ad4214b743751",
// };

const firebaseConfig = {
  apiKey: "AIzaSyD0cmNAsBDsecY08PPYYXDdGukEGbYpcRA",
  authDomain: "barracasdepraia-x.firebaseapp.com",
  databaseURL: "https://barracasdepraia-x-default-rtdb.firebaseio.com",
  projectId: "barracasdepraia-x",
  storageBucket: "barracasdepraia-x.firebasestorage.app",
  messagingSenderId: "584844051269",
  appId: "1:584844051269:android:8e91caf4e685a371f5b42c",
};

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

// const firebaseConfig = {
//   apiKey: "AIzaSyCYGbf_f8yL7WXc0qTH2YTpW61l52rrGbs",
//   authDomain: "bar-do-cesar.firebaseapp.com",
//   databaseURL: "https://bar-do-cesar-default-rtdb.firebaseio.com",
//   projectId: "bar-do-cesar",
//   storageBucket: "bar-do-cesar.firebasestorage.app",
//   messagingSenderId: "525946263891",
//   appId: "1:525946263891:android:804c41528d531c2b2c29a6",
// };
// Inicializa o Firebase para Firestore

// Inicializa o Firebase para Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const ensureFirebaseInitialized = async () => {
  try {
    if (!firebase.apps.length) {
      console.log("(NOBRIDGE) LOG Inicializando Firebase...");
      await firebase.initializeApp(firebaseConfig);

      // Autenticação anônima com tratamento melhorado
      try {
        await firebase.auth().signInAnonymously();
        console.log("(NOBRIDGE) LOG Autenticado anonimamente com sucesso");
      } catch (authError) {
        console.error(
          "(NOBRIDGE) ERROR Falha na autenticação anônima:",
          authError
        );
        throw new Error("Falha na autenticação");
      }

      console.log("(NOBRIDGE) LOG Firebase inicializado com sucesso");
    }

    // Verifica se há usuário autenticado
    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error("Nenhum usuário autenticado");
    }

    // Inicializa o Realtime Database
    const realtimeDb = firebase.database();
    if (!realtimeDb) {
      throw new Error("Falha ao obter referência do banco de dados Firebase.");
    }
    return realtimeDb;
  } catch (error) {
    console.error("(NOBRIDGE) ERROR Erro ao inicializar Firebase:", error);
    throw error;
  }
};

// Funções para o Controle de Fluxo de Caixa (usando Firestore)
export const openCashFlow = async (operatorName, openAmount) => {
  try {
    const cashFlowRef = doc(collection(db, "cash_flow"));
    const cashFlowData = {
      id: cashFlowRef.id,
      operatorName,
      openAmount,
      closeAmount: 0,
      cashPayments: 0,
      cardPayments: 0,
      pixPayments: 0,
      observations: "",
      openDate: Timestamp.now(),
      closeDate: null,
      status: "open",
    };
    await setDoc(cashFlowRef, cashFlowData);
    return cashFlowRef.id;
  } catch (error) {
    console.error("Error opening cash flow:", error);
    throw error;
  }
};

export const addCashFlowMovement = async (
  cashFlowId,
  type,
  amount,
  paymentMethod,
  description
) => {
  try {
    // Validar se o caixa existe e está aberto
    const cashFlowRef = doc(db, "cash_flow", cashFlowId);
    const cashFlowSnap = await getDoc(cashFlowRef);
    if (!cashFlowSnap.exists() || cashFlowSnap.data().status !== "open") {
      throw new Error("Cash flow does not exist or is closed");
    }

    const movementRef = doc(collection(db, "cash_flow_movements"));
    const movementData = {
      id: movementRef.id,
      cashFlowId,
      type, // 'entry' ou 'exit'
      amount,
      paymentMethod: paymentMethod || null, // 'cash', 'card', 'pix' ou null (para saídas)
      description,
      date: Timestamp.now(),
    };
    await setDoc(movementRef, movementData);
    return movementRef.id;
  } catch (error) {
    console.error("Error adding cash flow movement:", error);
    throw error;
  }
};

export const closeCashFlow = async (
  cashFlowId,
  closeAmount,
  cashPayments,
  cardPayments,
  pixPayments,
  observations
) => {
  try {
    // Validar se o caixa existe e está aberto
    const cashFlowRef = doc(db, "cash_flow", cashFlowId);
    const cashFlowSnap = await getDoc(cashFlowRef);
    if (!cashFlowSnap.exists() || cashFlowSnap.data().status !== "open") {
      throw new Error("Cash flow does not exist or is already closed");
    }

    const closeData = {
      closeAmount,
      cashPayments,
      cardPayments,
      pixPayments,
      observations,
      closeDate: Timestamp.now(),
      status: "closed",
    };
    await updateDoc(cashFlowRef, closeData);
    return cashFlowId;
  } catch (error) {
    console.error("Error closing cash flow:", error);
    throw error;
  }
};

export const getCashFlow = async (cashFlowId) => {
  try {
    const cashFlowRef = doc(db, "cash_flow", cashFlowId);
    const cashFlowSnap = await getDoc(cashFlowRef);
    if (!cashFlowSnap.exists()) {
      throw new Error("Cash flow not found");
    }
    return { id: cashFlowSnap.id, ...cashFlowSnap.data() };
  } catch (error) {
    console.error("Error fetching cash flow:", error);
    throw error;
  }
};

export const getCashFlowMovements = async (cashFlowId) => {
  try {
    const movementsQuery = query(
      collection(db, "cash_flow_movements"),
      where("cashFlowId", "==", cashFlowId),
      orderBy("date", "desc")
    );
    const movementsSnap = await getDocs(movementsQuery);
    return movementsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching cash flow movements:", error);
    throw error;
  }
};

export const getCashFlowReport = async (startDate, endDate) => {
  try {
    const cashFlowQuery = query(
      collection(db, "cash_flow"),
      where("openDate", ">=", Timestamp.fromDate(startDate)),
      where("openDate", "<=", Timestamp.fromDate(endDate)),
      orderBy("openDate", "desc")
    );
    const cashFlowSnap = await getDocs(cashFlowQuery);
    const cashFlows = cashFlowSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Agregar totais
    const report = {
      totalCash: cashFlows.reduce((sum, cf) => sum + (cf.cashPayments || 0), 0),
      totalCard: cashFlows.reduce((sum, cf) => sum + (cf.cardPayments || 0), 0),
      totalPix: cashFlows.reduce((sum, cf) => sum + (cf.pixPayments || 0), 0),
      cashFlows,
    };
    return report;
  } catch (error) {
    console.error("Error generating cash flow report:", error);
    throw error;
  }
};

// Exportar todas as funções necessárias
export {
  db,
  firebase,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  limit,
};
