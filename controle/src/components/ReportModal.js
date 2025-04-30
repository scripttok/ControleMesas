import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Modal,
  StyleSheet,
  FlatList,
} from "react-native";
import { getCashFlowReport } from "../services/firebase";

const ReportModal = ({ visible, onClose }) => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  const handleGenerateReport = async () => {
    try {
      setError("");
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        setError("Por favor, insira datas válidas (YYYY-MM-DD).");
        return;
      }
      if (start > end) {
        setError("A data inicial deve ser anterior à data final.");
        return;
      }
      const reportData = await getCashFlowReport(start, end);
      setReport(reportData);
    } catch (err) {
      setError("Erro ao gerar relatório. Tente novamente.");
      console.error("Error generating report:", err);
    }
  };

  const renderCashFlowItem = ({ item }) => (
    <View style={styles.cashFlowItem}>
      <Text style={styles.cashFlowText}>ID: {item.id}</Text>
      <Text style={styles.cashFlowText}>Operador: {item.operatorName}</Text>
      <Text style={styles.cashFlowText}>
        Valor Inicial: R$ {item.openAmount.toFixed(2)}
      </Text>
      <Text style={styles.cashFlowText}>
        Valor Final: R$ {item.closeAmount.toFixed(2)}
      </Text>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Gerar Relatório</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TextInput
            style={styles.input}
            placeholder="Data Inicial (YYYY-MM-DD)"
            value={startDate}
            onChangeText={setStartDate}
            placeholderTextColor="#888"
          />
          <TextInput
            style={styles.input}
            placeholder="Data Final (YYYY-MM-DD)"
            value={endDate}
            onChangeText={setEndDate}
            placeholderTextColor="#888"
          />
          <Button
            title="Gerar Relatório"
            onPress={handleGenerateReport}
            color="#FFA500"
          />
          {report && (
            <View style={styles.reportContainer}>
              <Text style={styles.reportTitle}>Resumo do Relatório</Text>
              <Text style={styles.reportText}>
                Total em Dinheiro: R$ {report.totalCash.toFixed(2)}
              </Text>
              <Text style={styles.reportText}>
                Total em Cartão: R$ {report.totalCard.toFixed(2)}
              </Text>
              <Text style={styles.reportText}>
                Total em Pix: R$ {report.totalPix.toFixed(2)}
              </Text>
              <FlatList
                data={report.cashFlows}
                renderItem={renderCashFlowItem}
                keyExtractor={(item) => item.id}
                style={styles.cashFlowList}
              />
            </View>
          )}
          <Button title="Fechar" onPress={onClose} color="#FF4444" />
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
  reportContainer: {
    marginTop: 20,
    width: "100%",
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#5C4329",
  },
  reportText: {
    fontSize: 14,
    marginBottom: 5,
    color: "#000",
  },
  cashFlowList: {
    maxHeight: 200,
    marginTop: 10,
  },
  cashFlowItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  cashFlowText: {
    fontSize: 14,
    color: "#000",
  },
});

export default ReportModal;
