import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from "react-native";
import {
  db,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  getCashFlowMovements,
} from "../services/firebase";
import OpenCashFlowModal from "../components/OpenCashFlowModal";
import AddMovementModal from "../components/AddMovementModal";
import CloseCashFlowModal from "../components/CloseCashFlowModal";
import ReportModal from "../components/ReportModal";

const CashFlowScreen = ({ navigation }) => {
  const [cashFlow, setCashFlow] = useState(null);
  const [movements, setMovements] = useState([]);
  const [error, setError] = useState(null);
  const [openModalVisible, setOpenModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  useEffect(() => {
    const fetchCashFlow = async () => {
      try {
        const cashFlowsQuery = query(
          collection(db, "cash_flow"),
          where("status", "==", "open"),
          orderBy("openDate", "desc"),
          limit(1)
        );
        const cashFlowsSnap = await getDocs(cashFlowsQuery);
        if (!cashFlowsSnap.empty) {
          const cashFlowData = cashFlowsSnap.docs[0].data();
          const cashFlowId = cashFlowsSnap.docs[0].id;
          setCashFlow({ id: cashFlowId, ...cashFlowData });
          const movementsData = await getCashFlowMovements(cashFlowId);
          setMovements(movementsData);
        } else {
          setCashFlow(null);
          setMovements([]);
        }
        setError(null);
      } catch (error) {
        console.error("Error fetching cash flow:", error);
        setError("Não foi possível carregar o caixa. Tente novamente.");
      }
    };
    fetchCashFlow();
  }, []);

  const handleOpenSuccess = (cashFlowId) => {
    setCashFlow({
      id: cashFlowId,
      operatorName: "",
      openAmount: 0,
      status: "open",
    });
    const fetchCashFlow = async () => {
      try {
        const cashFlowsQuery = query(
          collection(db, "cash_flow"),
          where("status", "==", "open"),
          orderBy("openDate", "desc"),
          limit(1)
        );
        const cashFlowsSnap = await getDocs(cashFlowsQuery);
        if (!cashFlowsSnap.empty) {
          const cashFlowData = cashFlowsSnap.docs[0].data();
          const cashFlowId = cashFlowsSnap.docs[0].id;
          setCashFlow({ id: cashFlowId, ...cashFlowData });
          const movementsData = await getCashFlowMovements(cashFlowId);
          setMovements(movementsData);
        }
      } catch (error) {
        console.error("Error fetching cash flow:", error);
        setError("Não foi possível carregar o caixa. Tente novamente.");
      }
    };
    fetchCashFlow();
  };

  const handleMovementSuccess = () => {
    const fetchMovements = async () => {
      if (cashFlow) {
        try {
          const movementsData = await getCashFlowMovements(cashFlow.id);
          setMovements(movementsData);
        } catch (error) {
          console.error("Error fetching movements:", error);
        }
      }
    };
    fetchMovements();
  };

  const handleCloseSuccess = () => {
    setCashFlow(null);
    setMovements([]);
  };

  const renderMovementItem = ({ item }) => (
    <View style={styles.movementItem}>
      <Text style={styles.movementText}>
        {item.type === "entry" ? "Entrada" : "Saída"}: R${" "}
        {item.amount.toFixed(2)}
      </Text>
      <Text style={styles.movementText}>
        Método: {item.paymentMethod || "N/A"}
      </Text>
      <Text style={styles.movementText}>Descrição: {item.description}</Text>
      <Text style={styles.movementText}>
        Data: {new Date(item.date).toLocaleString("pt-BR")}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Controle de Fluxo de Caixa</Text>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : cashFlow ? (
        <View style={styles.cashFlowInfo}>
          <Text style={styles.infoText}>
            Caixa Aberto por: {cashFlow.operatorName}
          </Text>
          <Text style={styles.infoText}>
            Valor Inicial: R$ {cashFlow.openAmount.toFixed(2)}
          </Text>
        </View>
      ) : (
        <Text style={styles.infoText}>Nenhum caixa aberto</Text>
      )}

      {cashFlow && movements.length > 0 ? (
        <View style={styles.movementsContainer}>
          <Text style={styles.movementsTitle}>Movimentações</Text>
          <FlatList
            data={movements}
            renderItem={renderMovementItem}
            keyExtractor={(item) => item.id}
            style={styles.movementsList}
          />
        </View>
      ) : cashFlow ? (
        <Text style={styles.infoText}>Nenhuma movimentação registrada</Text>
      ) : null}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, cashFlow && styles.buttonDisabled]}
          onPress={() => setOpenModalVisible(true)}
          disabled={!!cashFlow}
        >
          <Text style={styles.buttonText}>Abrir Caixa</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, !cashFlow && styles.buttonDisabled]}
          onPress={() => setAddModalVisible(true)}
          disabled={!cashFlow}
        >
          <Text style={styles.buttonText}>Registrar Entrada</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, !cashFlow && styles.buttonDisabled]}
          onPress={() => setAddModalVisible(true)}
          disabled={!cashFlow}
        >
          <Text style={styles.buttonText}>Registrar Saída</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, !cashFlow && styles.buttonDisabled]}
          onPress={() => setCloseModalVisible(true)}
          disabled={!cashFlow}
        >
          <Text style={styles.buttonText}>Fechar Caixa</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => setReportModalVisible(true)}
        >
          <Text style={styles.buttonText}>Gerar Relatório</Text>
        </TouchableOpacity>
      </View>

      <OpenCashFlowModal
        visible={openModalVisible}
        onClose={() => setOpenModalVisible(false)}
        onSuccess={handleOpenSuccess}
      />
      <AddMovementModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        cashFlowId={cashFlow?.id}
        onSuccess={handleMovementSuccess}
      />
      <CloseCashFlowModal
        visible={closeModalVisible}
        onClose={() => setCloseModalVisible(false)}
        cashFlowId={cashFlow?.id}
        onSuccess={handleCloseSuccess}
      />
      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#5C4329",
  },
  cashFlowInfo: {
    marginBottom: 16,
  },
  infoText: {
    fontSize: 16,
    marginBottom: 8,
    textAlign: "center",
    color: "#000",
  },
  errorText: {
    fontSize: 16,
    color: "red",
    marginBottom: 16,
    textAlign: "center",
  },
  movementsContainer: {
    flex: 1,
    marginBottom: 16,
  },
  movementsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#5C4329",
  },
  movementsList: {
    flex: 1,
  },
  movementItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  movementText: {
    fontSize: 14,
    color: "#000",
  },
  buttonContainer: {
    flexDirection: "column",
    alignItems: "center",
  },
  button: {
    backgroundColor: "#FFA500",
    padding: 12,
    borderRadius: 10,
    marginVertical: 10,
    width: "80%",
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default CashFlowScreen;
