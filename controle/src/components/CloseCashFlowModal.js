import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, Modal, StyleSheet } from "react-native";
import { db, doc, getDoc } from "../services/firebase";
import { closeCashFlow } from "../services/firebase";

const CloseCashFlowModal = ({ visible, onClose, cashFlowId, onSuccess }) => {
  const [closeAmount, setCloseAmount] = useState("");
  const [cashPayments, setCashPayments] = useState("");
  const [cardPayments, setCardPayments] = useState("");
  const [pixPayments, setPixPayments] = useState("");
  const [observations, setObservations] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCashFlowData = async () => {
      if (visible && cashFlowId) {
        try {
          const cashFlowRef = doc(db, "cash_flow", cashFlowId);
          const cashFlowSnap = await getDoc(cashFlowRef);
          if (cashFlowSnap.exists()) {
            const data = cashFlowSnap.data();
            console.log("Dados do caixa:", data);
            setCloseAmount(
              data.closeAmount?.toString().replace(".", ",") || ""
            );
            setCashPayments(
              data.cashPayments?.toString().replace(".", ",") || ""
            );
            setCardPayments(
              data.cardPayments?.toString().replace(".", ",") || ""
            );
            setPixPayments(
              data.pixPayments?.toString().replace(".", ",") || ""
            );
            setObservations(data.observations || "");
          } else {
            setError("Caixa não encontrado.");
          }
        } catch (error) {
          console.error("Erro ao carregar dados do caixa:", error);
          setError("Erro ao carregar os dados do caixa.");
        }
      }
    };
    fetchCashFlowData();
  }, [visible, cashFlowId]);

  const handleSubmit = async () => {
    try {
      setError("");
      const closeAmountValue = parseFloat(closeAmount.replace(",", "."));
      const cashPaymentsValue = parseFloat(cashPayments.replace(",", "."));
      const cardPaymentsValue = parseFloat(cardPayments.replace(",", "."));
      const pixPaymentsValue = parseFloat(pixPayments.replace(",", "."));

      if (isNaN(closeAmountValue) || closeAmountValue < 0) {
        setError("O valor final deve ser um número maior ou igual a 0.");
        return;
      }
      if (isNaN(cashPaymentsValue) || cashPaymentsValue < 0) {
        setError("O total em dinheiro deve ser um número maior ou igual a 0.");
        return;
      }
      if (isNaN(cardPaymentsValue) || cardPaymentsValue < 0) {
        setError("O total em cartão deve ser um número maior ou igual a 0.");
        return;
      }
      if (isNaN(pixPaymentsValue) || pixPaymentsValue < 0) {
        setError("O total em Pix deve ser um número maior ou igual a 0.");
        return;
      }

      await closeCashFlow(
        cashFlowId,
        closeAmountValue,
        cashPaymentsValue,
        cardPaymentsValue,
        pixPaymentsValue,
        observations.trim()
      );
      onSuccess();
      setCloseAmount("");
      setCashPayments("");
      setCardPayments("");
      setPixPayments("");
      setObservations("");
      onClose();
    } catch (err) {
      setError("Erro ao fechar o caixa. Tente novamente.");
      console.error("Error closing cash flow:", err);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Fechar Caixa</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TextInput
            style={styles.input}
            placeholder="Valor Final (R$)"
            placeholderTextColor="#000"
            value={closeAmount}
            onChangeText={setCloseAmount}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.input}
            placeholder="Total em Dinheiro (R$)"
            placeholderTextColor="#000"
            value={cashPayments}
            onChangeText={setCashPayments}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.input}
            placeholder="Total em Cartão (R$)"
            placeholderTextColor="#000"
            value={cardPayments}
            onChangeText={setCardPayments}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.input}
            placeholder="Total em Pix (R$)"
            placeholderTextColor="#000"
            value={pixPayments}
            onChangeText={setPixPayments}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.input}
            placeholder="Observações"
            placeholderTextColor="#000"
            value={observations}
            onChangeText={setObservations}
          />
          <View style={styles.buttonContainer}>
            <Button title="Confirmar" onPress={handleSubmit} color="#FFA500" />
            <Button title="Cancelar" onPress={onClose} color="#FF4444" />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    width: "80%",
    padding: 20,
    backgroundColor: "#FFF",
    borderRadius: 10,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#5C4329",
  },
  input: {
    width: "100%",
    height: 40,
    borderColor: "#5C4329",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 15,
    color: "#000",
  },
  errorText: {
    color: "red",
    marginBottom: 10,
    textAlign: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
});

export default CloseCashFlowModal;
