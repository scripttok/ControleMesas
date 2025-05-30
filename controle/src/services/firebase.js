import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/database";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  getDoc,
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

let firebaseInitialized = false;
let auth, database, db;

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("Inicializando Firebase...");
    firebaseInitialized = true;
  } else {
    firebase.app();
    console.log("Firebase já inicializado.");
    firebaseInitialized = true;
  }

  auth = firebase.auth();
  database = firebase.database();
  db = getFirestore(firebase.app());

  auth
    .signInAnonymously()
    .then(() => console.log("Autenticado anonimamente com sucesso"))
    .catch((error) => console.error("Erro na autenticação anônima:", error));

  console.log("Firebase inicializado com sucesso");
} catch (error) {
  console.error("Erro ao inicializar Firebase:", error);
}

const waitForFirebaseInit = async () => {
  if (firebase.apps.length === 0) {
    console.log("(NOBRIDGE) LOG waitForFirebaseInit - Inicializando Firebase");
    try {
      firebase.initializeApp(firebaseConfig);
      console.log(
        "(NOBRIDGE) LOG waitForFirebaseInit - Firebase inicializado com sucesso"
      );
    } catch (error) {
      console.error(
        "(NOBRIDGE) ERROR waitForFirebaseInit - Erro ao inicializar Firebase:",
        error
      );
      return null;
    }
  } else {
    console.log(
      "(NOBRIDGE) LOG waitForFirebaseInit - Firebase já inicializado"
    );
  }
  const db = firebase.database();
  if (!db) {
    console.error(
      "(NOBRIDGE) ERROR waitForFirebaseInit - Database não inicializada"
    );
    return null;
  }
  return db;
};

async function openCashFlow(operatorName, openAmount) {
  await waitForFirebaseInit();
  try {
    const cashFlowRef = await addDoc(collection(db, "cash_flow"), {
      operatorName,
      openAmount,
      openDate: Timestamp.fromDate(new Date()),
      status: "open",
    });
    console.log("Caixa aberto com ID:", cashFlowRef.id);
    return cashFlowRef.id;
  } catch (error) {
    console.error("Error opening cash flow:", error);
    throw error;
  }
}

async function addCashFlowMovement(
  cashFlowId,
  type,
  amount,
  paymentMethod,
  description
) {
  await waitForFirebaseInit();
  try {
    console.log("Registrando movimentação:", {
      cashFlowId,
      type,
      amount,
      paymentMethod,
      description,
    });
    const movementRef = await addDoc(collection(db, "cash_flow_movements"), {
      cashFlowId,
      type,
      amount,
      paymentMethod,
      description,
      date: Timestamp.fromDate(new Date()),
    });
    console.log("Movimentação registrada com ID:", movementRef.id);
  } catch (error) {
    console.error("Error adding cash flow movement:", error);
    throw error;
  }
}

async function closeCashFlow(
  cashFlowId,
  closeAmount,
  cashPayments,
  cardPayments,
  pixPayments,
  observations
) {
  try {
    const cashFlowRef = doc(db, "cash_flow", cashFlowId);
    await updateDoc(cashFlowRef, {
      closeAmount: Number(closeAmount),
      cashPayments: Number(cashPayments),
      cardPayments: Number(cardPayments),
      pixPayments: Number(pixPayments),
      observations: observations || "",
      status: "closed",
      closeDate: serverTimestamp(),
    });
    console.log("Caixa fechado:", cashFlowId);
  } catch (error) {
    console.error("Error closing cash flow:", error);
    throw error;
  }
}

async function getCashFlowMovements(cashFlowId) {
  try {
    const movementsQuery = query(
      collection(db, "cash_flow_movements"),
      where("cashFlowId", "==", cashFlowId),
      orderBy("date", "desc")
    );
    const movementsSnap = await getDocs(movementsQuery);
    const movements = [];
    movementsSnap.forEach((doc) => {
      const data = doc.data();
      if (
        data.date &&
        typeof data.amount === "number" &&
        ["entry", "exit"].includes(data.type)
      ) {
        movements.push({
          id: doc.id,
          ...data,
          amount: Number(data.amount) || 0,
          date:
            data.date instanceof Timestamp
              ? data.date.toDate()
              : new Date(data.date),
        });
      }
    });
    console.log("Movimentações carregadas:", movements.length);
    return movements;
  } catch (error) {
    console.error("Error fetching cash flow movements:", error);
    throw error;
  }
}

async function getCashFlowReport(startDate, endDate) {
  await waitForFirebaseInit();
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid startDate or endDate");
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const startUTC = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    const endUTC = new Date(end.getTime() + 3 * 60 * 60 * 1000);

    const startTimestamp = Timestamp.fromDate(startUTC);
    const endTimestamp = Timestamp.fromDate(endUTC);
    console.log("Datas do relatório de caixas:", {
      start: start.toISOString(),
      end: end.toISOString(),
      startTimestamp: startTimestamp.toDate().toISOString(),
      endTimestamp: endTimestamp.toDate().toISOString(),
    });

    const cashFlowsQuery = query(
      collection(db, "cash_flow"),
      where("openDate", ">=", startTimestamp),
      where("openDate", "<=", endTimestamp)
    );
    const cashFlowsSnap = await getDocs(cashFlowsQuery);
    const cashFlows = [];
    cashFlowsSnap.forEach((doc) => {
      const data = doc.data();
      console.log("Caixa bruto:", {
        id: doc.id,
        openDate:
          data.openDate instanceof Timestamp
            ? data.openDate.toDate().toISOString()
            : data.openDate,
        status: data.status,
        cashPayments: data.cashPayments,
        cardPayments: data.cardPayments,
        pixPayments: data.pixPayments,
      });
      if (data.openDate && ["open", "closed"].includes(data.status)) {
        cashFlows.push({
          id: doc.id,
          ...data,
          openDate:
            data.openDate instanceof Timestamp
              ? data.openDate.toDate().toISOString()
              : new Date(data.openDate).toISOString(),
          cashPayments: Number(data.cashPayments) || 0,
          cardPayments: Number(data.cardPayments) || 0,
          pixPayments: Number(data.pixPayments) || 0,
        });
      } else {
        console.warn("Caixa inválido ignorado:", { id: doc.id, ...data });
      }
    });
    console.log("Caixas válidos encontrados:", cashFlows.length, cashFlows);

    let totalCash = 0;
    let totalCard = 0;
    let totalPix = 0;

    cashFlows.forEach((cashFlow) => {
      if (cashFlow.status === "closed") {
        totalCash += Number(cashFlow.cashPayments) || 0;
        totalCard += Number(cashFlow.cardPayments) || 0; // Corrigido
        totalPix += Number(cashFlow.pixPayments) || 0;
      }
    });

    console.log("Totais de caixas:", { totalCash, totalCard, totalPix });

    return {
      cashFlows,
      totalCash,
      totalCard,
      totalPix,
    };
  } catch (error) {
    console.error("Error generating cash flow report:", error);
    throw error;
  }
}

async function getCashFlowMovementsReport(
  startDate,
  endDate,
  type = null,
  paymentMethod = null
) {
  await waitForFirebaseInit();
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid startDate or endDate");
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const startUTC = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    const endUTC = new Date(end.getTime() + 3 * 60 * 60 * 1000);

    const startTimestamp = Timestamp.fromDate(startUTC);
    const endTimestamp = Timestamp.fromDate(endUTC);
    console.log("Datas do relatório de movimentações:", {
      start: start.toISOString(),
      end: end.toISOString(),
      startTimestamp: startTimestamp.toDate().toISOString(),
      endTimestamp: endTimestamp.toDate().toISOString(),
    });

    let baseQuery = query(
      collection(db, "cash_flow_movements"),
      where("date", ">=", startTimestamp),
      where("date", "<=", endTimestamp),
      orderBy("date", "desc")
    );

    if (type) {
      baseQuery = query(baseQuery, where("type", "==", type));
    }
    if (paymentMethod) {
      baseQuery = query(baseQuery, where("paymentMethod", "==", paymentMethod));
    }

    const movementsSnap = await getDocs(baseQuery);
    const movements = [];
    movementsSnap.forEach((doc) => {
      const data = doc.data();
      console.log("Documento bruto:", {
        id: doc.id,
        date:
          data.date instanceof Timestamp
            ? data.date.toDate().toISOString()
            : data.date,
        amount: data.amount,
        type: data.type,
        paymentMethod: data.paymentMethod,
      });
      if (
        data.date &&
        typeof data.amount === "number" &&
        ["entry", "exit"].includes(data.type) &&
        (!data.paymentMethod ||
          ["cash", "card", "pix"].includes(data.paymentMethod))
      ) {
        movements.push({
          id: doc.id,
          ...data,
          amount: Number(data.amount) || 0,
          date:
            data.date instanceof Timestamp
              ? data.date.toDate().toISOString()
              : new Date(data.date).toISOString(),
        });
      } else {
        console.warn("Documento inválido ignorado:", { id: doc.id, ...data });
      }
    });
    console.log(
      "Movimentações válidas no relatório:",
      movements.length,
      movements
    );

    let totalEntries = 0;
    let totalExits = 0;
    let totalCash = 0;
    let totalCard = 0;
    let totalPix = 0;

    movements.forEach((movement) => {
      const amount = Number(movement.amount) || 0;
      console.log("Processando movimentação:", movement);
      if (movement.type === "entry") {
        totalEntries += amount;
        if (movement.paymentMethod === "cash") totalCash += amount;
        if (movement.paymentMethod === "card") totalCard += amount;
        if (movement.paymentMethod === "pix") totalPix += amount;
      } else if (movement.type === "exit") {
        totalExits += amount;
      }
    });

    const balance = totalEntries - totalExits;
    console.log("Totais do relatório:", {
      totalEntries,
      totalExits,
      balance,
      totalCash,
      totalCard,
      totalPix,
    });

    return {
      movements,
      totalEntries,
      totalExits,
      totalCash,
      totalCard,
      totalPix,
      balance,
    };
  } catch (error) {
    console.error("Error generating movements report:", error);
    throw error;
  }
}

export {
  auth,
  database,
  db,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getDoc,
  Timestamp,
  openCashFlow,
  addCashFlowMovement,
  closeCashFlow,
  getCashFlowMovements,
  getCashFlowReport,
  getCashFlowMovementsReport,
  waitForFirebaseInit,
};
