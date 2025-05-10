import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  Linking,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import {
  fecharMesa,
  enviarComandaViaWhatsApp,
  removerPedidosDaMesa,
} from "../services/mesaService";
import { printOrder } from "../services/printerService";
import * as FileSystem from "expo-file-system";
import { salvarHistoricoPedido } from "../services/mesaService";

export default function FecharComandaModal({
  visible,
  onClose,
  mesa,
  pedidos,
  cardapio,
  onFecharComanda,
  onAtualizarMesa,
}) {
  const [valorPago, setValorPago] = useState("");
  const [valorRecebido, setValorRecebido] = useState("");
  const [divisao, setDivisao] = useState("1");
  const [telefoneCliente, setTelefoneCliente] = useState("");
  const [desconto, setDesconto] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [metodoPagamento, setMetodoPagamento] = useState("dinheiro");

  useEffect(() => {
    return () => {
      setIsSubmitting(false);
    };
  }, []);

  const calcularTotalPedido = (itens) => {
    const itensValidos = Array.isArray(itens) ? itens : [];
    const total = itensValidos.reduce((total, i) => {
      const itemCardapio = cardapio.find((c) => c.nome === i.nome);
      const precoUnitario =
        itemCardapio && !isNaN(parseFloat(itemCardapio.precoUnitario))
          ? parseFloat(itemCardapio.precoUnitario)
          : 0;
      const quantidade = i.quantidade || 0;
      console.log("(NOBRIDGE) LOG calcularTotalPedido - Item:", {
        nome: i.nome,
        precoUnitario,
        quantidade,
        subtotal: quantidade * precoUnitario,
      });
      return total + quantidade * precoUnitario;
    }, 0);
    console.log("(NOBRIDGE) LOG calcularTotalPedido - Total:", total);
    return total.toFixed(2);
  };

  const calcularTotalSemDesconto = () => {
    if (!pedidos || pedidos.length === 0) return "0.00";
    const total = pedidos.reduce((total, pedido) => {
      const pedidoTotal = parseFloat(calcularTotalPedido(pedido.itens)) || 0;
      console.log(
        "(NOBRIDGE) LOG calcularTotalSemDesconto - Pedido total:",
        pedidoTotal
      );
      return total + pedidoTotal;
    }, 0);
    console.log("(NOBRIDGE) LOG calcularTotalSemDesconto - Total:", total);
    return total.toFixed(2);
  };

  const calcularTotalComDesconto = () => {
    const totalSemDesconto = parseFloat(calcularTotalSemDesconto()) || 0;
    const descontoNum = parseFloat(desconto) || 0;
    const total = Math.max(0, totalSemDesconto - descontoNum);
    console.log(
      "(NOBRIDGE) LOG calcularTotalComDesconto - Total com desconto:",
      total
    );
    return total.toFixed(2);
  };

  const calcularRestante = () => {
    const totalComDesconto = parseFloat(calcularTotalComDesconto()) || 0;
    const pagoAnterior = parseFloat(mesa?.valorPago) || 0;
    const pagoNovo = parseFloat(valorPago) || 0;
    const restante = Math.max(0, totalComDesconto - (pagoAnterior + pagoNovo));
    console.log("(NOBRIDGE) LOG calcularRestante - Restante:", restante);
    return restante.toFixed(2);
  };

  const calcularDivisao = () => {
    const restante = parseFloat(calcularRestante()) || 0;
    const numDivisao = parseInt(divisao) || 1;
    const divisao = restante / numDivisao;
    console.log("(NOBRIDGE) LOG calcularDivisao - Divisão:", divisao);
    return divisao.toFixed(2);
  };

  const calcularTroco = () => {
    const recebido = parseFloat(valorRecebido) || 0;
    const restante = parseFloat(calcularRestante()) || 0;
    const troco = Math.max(0, recebido - restante);
    console.log("(NOBRIDGE) LOG calcularTroco - Troco:", troco);
    return troco.toFixed(2);
  };

  const isPagamentoSuficiente = () => {
    const restante = parseFloat(calcularRestante()) || 0;
    const recebido = parseFloat(valorRecebido) || 0;
    return recebido >= restante;
  };

  const isPagamentoParcial = () => {
    const totalComDesconto = parseFloat(calcularTotalComDesconto()) || 0;
    const pagoAnterior = parseFloat(mesa?.valorPago) || 0;
    const pagoNovo = parseFloat(valorPago) || 0;
    const pagoTotal = pagoAnterior + pagoNovo;
    return pagoTotal > 0 && pagoTotal < totalComDesconto;
  };

  const getResumoConta = () => {
    const itensEntregues = pedidos
      .filter((p) => p.entregue)
      .flatMap((p) => p.itens || []);
    const resumo = itensEntregues.reduce((acc, item) => {
      acc[item.nome] = (acc[item.nome] || 0) + item.quantidade;
      return acc;
    }, {});
    const itens = Object.entries(resumo).map(([item, quantidade]) => {
      const itemCardapio = cardapio.find((c) => c.nome === item);
      const precoUnitario =
        itemCardapio && !isNaN(parseFloat(itemCardapio.precoUnitario))
          ? parseFloat(itemCardapio.precoUnitario)
          : 0;
      const subtotal = precoUnitario * quantidade;
      console.log("(NOBRIDGE) LOG getResumoConta - Item:", {
        item,
        quantidade,
        precoUnitario,
        subtotal,
      });
      return {
        item,
        quantidade,
        precoUnitario,
        subtotal,
      };
    });
    const resumoConta = {
      nomeCliente: mesa?.nomeCliente || "N/A",
      itens,
      totalSemDesconto: calcularTotalSemDesconto(),
      desconto: parseFloat(desconto) || 0,
      total: calcularTotalComDesconto(),
      pago: (parseFloat(mesa?.valorPago) || 0) + (parseFloat(valorPago) || 0),
      restante: calcularRestante(),
    };
    console.log("(NOBRIDGE) LOG getResumoConta - Resumo:", resumoConta);
    return resumoConta;
  };

  const salvarPedidoNoHistorico = async (dadosPedido) => {
    try {
      const dataAtual = new Date().toISOString();
      const nomeArquivo = `pedido_mesa_${mesa.id}_${dataAtual.replace(
        /[:.]/g,
        "-"
      )}.json`;
      const caminhoArquivo = `${FileSystem.documentDirectory}${nomeArquivo}`;

      await FileSystem.writeAsStringAsync(
        caminhoArquivo,
        JSON.stringify({
          ...dadosPedido,
          dataFechamento: dataAtual,
          fileName: nomeArquivo,
        })
      );

      console.log("(NOBRIDGE) LOG Pedido salvo no histórico:", nomeArquivo);
    } catch (error) {
      console.error(
        "(NOBRIDGE) ERROR Erro ao salvar pedido no histórico:",
        error
      );
      throw error;
    }
  };

  const handleFecharComanda = async () => {
    if (!mesa || isSubmitting) return;

    const totalSemDesconto = parseFloat(calcularTotalSemDesconto()) || 0;
    const descontoNum = parseFloat(desconto) || 0;

    setIsSubmitting(true);

    try {
      const totalComDesconto = parseFloat(calcularTotalComDesconto()) || 0;
      const pagoAnterior = parseFloat(mesa?.valorPago) || 0;
      const pagoNovo = parseFloat(valorPago) || 0;
      const recebido = parseFloat(valorRecebido) || 0;
      const troco = calcularTroco();
      const pagoTotal = pagoAnterior + pagoNovo;

      const dataFechamento = new Date().toISOString();
      const historicoPagamentos = mesa.historicoPagamentos || [];

      if (pagoNovo > 0) {
        historicoPagamentos.push({
          valor: pagoNovo,
          metodo: metodoPagamento,
          data: dataFechamento,
        });
      }

      const dadosParaHistorico = {
        nomeCliente: mesa.nomeCliente,
        itens: getResumoConta().itens,
        totalSemDesconto,
        desconto: descontoNum,
        total: totalComDesconto,
        recebido,
        troco,
        dataFechamento,
        historicoPagamentos,
      };

      console.log(
        "(NOBRIDGE) LOG Dados completos para histórico:",
        dadosParaHistorico
      );

      await salvarHistoricoPedido(dadosParaHistorico);
      await removerPedidosDaMesa(mesa.id);

      await fecharMesa(mesa.id, {
        valorPago: pagoTotal,
        valorRestante: 0,
        valorRecebido: recebido,
        troco,
        desconto: descontoNum,
        status: "fechada",
        historicoPagamentos,
      });

      onAtualizarMesa({
        ...mesa,
        valorPago: pagoTotal,
        valorRestante: 0,
        valorRecebido: recebido,
        troco,
        desconto: descontoNum,
        status: "fechada",
        historicoPagamentos,
      });

      Alert.alert("Sucesso", "Comanda fechada com sucesso!");
      onFecharComanda();
    } catch (error) {
      console.error("(NOBRIDGE) ERROR Erro completo ao fechar comanda:", error);
      Alert.alert(
        "Erro",
        `Não foi possível fechar a comanda: ${error.message}`
      );
    } finally {
      setIsSubmitting(false);
      setDesconto("");
      setValorPago("");
      setValorRecebido("");
    }
  };

  const handleRecebidoParcial = async () => {
    if (!mesa || isSubmitting) return;
    const pagoNovo = parseFloat(valorPago) || 0;
    const descontoNum = parseFloat(desconto) || 0;
    const totalSemDesconto = parseFloat(calcularTotalSemDesconto()) || 0;
    if (descontoNum > totalSemDesconto) {
      Alert.alert(
        "Erro",
        "O desconto não pode ser maior que o total sem desconto."
      );
      return;
    }
    if (pagoNovo <= 0) {
      Alert.alert(
        "Erro",
        "O valor pago deve ser maior que 0 para registrar um pagamento parcial."
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const totalComDesconto = parseFloat(calcularTotalComDesconto()) || 0;
      const pagoAnterior = parseFloat(mesa?.valorPago) || 0;
      const recebido = parseFloat(valorRecebido) || 0;
      const pagoTotal = pagoAnterior + pagoNovo;
      const restante = Math.max(0, totalComDesconto - pagoTotal).toFixed(2);
      const troco =
        recebido > pagoNovo ? (recebido - pagoNovo).toFixed(2) : "0.00";

      const historicoPagamentos = mesa.historicoPagamentos || [];
      if (pagoNovo > 0) {
        historicoPagamentos.push({
          valor: pagoNovo,
          metodo: metodoPagamento,
          data: new Date().toISOString(),
        });
      }

      const updates = {
        valorPago: pagoTotal,
        valorRestante: restante,
        valorRecebido: recebido,
        troco,
        desconto: descontoNum,
        status: "aberta",
        historicoPagamentos,
      };

      console.log(
        "(NOBRIDGE) LOG Antes de chamar fecharMesa para pagamento parcial:",
        updates
      );
      await fecharMesa(mesa.id, updates);

      Alert.alert(
        "Sucesso",
        `Pagamento parcial de R$ ${pagoNovo.toFixed(
          2
        )} registrado! Restante: R$ ${restante}`
      );
      onAtualizarMesa({
        ...mesa,
        ...updates,
      });
      setValorPago("");
      setValorRecebido("");
      setDesconto("");
    } catch (error) {
      Alert.alert(
        "Erro",
        `Não foi possível registrar o pagamento parcial: ${error.message}`
      );
      console.error(
        "(NOBRIDGE) ERROR Erro ao registrar pagamento parcial:",
        error
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnviarWhatsApp = async () => {
    if (!mesa || pedidos.length === 0 || isSubmitting) {
      Alert.alert("Erro", "Nenhum pedido para enviar.");
      return;
    }

    const totalSemDesconto = parseFloat(calcularTotalSemDesconto()) || 0;
    const descontoNum = parseFloat(desconto) || 0;

    if (descontoNum > totalSemDesconto) {
      Alert.alert(
        "Erro",
        "O desconto não pode ser maior que o total sem desconto."
      );
      return;
    }

    let numeroLimpo = telefoneCliente.replace(/[^\d+]/g, "");
    if (!numeroLimpo) {
      Alert.alert("Erro", "Por favor, insira um número de telefone.");
      return;
    }

    if (!numeroLimpo.startsWith("+")) {
      numeroLimpo = `+55${numeroLimpo}`;
    }

    if (
      numeroLimpo.length < 12 ||
      (numeroLimpo.startsWith("+55") && numeroLimpo.length < 13)
    ) {
      Alert.alert(
        "Erro",
        "Número inválido. Use o formato DDD + número (ex.: 11987654321) ou internacional (ex.: +12025550123)."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const whatsappUrl = await enviarComandaViaWhatsApp(
        mesa.id,
        pedidos,
        cardapio,
        numeroLimpo
      );

      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
        Alert.alert("Sucesso", "Comanda enviada via WhatsApp!");
      } else {
        Alert.alert(
          "Erro",
          "WhatsApp não está instalado ou não suporta envio de mensagens."
        );
      }
    } catch (error) {
      Alert.alert(
        "Erro",
        `Não foi possível enviar via WhatsApp: ${error.message}`
      );
      console.error("(NOBRIDGE) ERROR Erro ao enviar via WhatsApp:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImprimirComanda = async () => {
    if (!mesa || pedidos.length === 0 || isSubmitting) {
      Alert.alert("Erro", "Nenhum pedido para imprimir.");
      return;
    }

    setIsSubmitting(true);
    try {
      const resumoConta = getResumoConta();
      const order = {
        title: `Comanda - ${mesa.nomeCliente || "Cliente"}`,
        client: {
          name: mesa.nomeCliente || "N/A",
          phone: telefoneCliente || "N/A",
          cpf: "N/A",
        },
        delivery: {
          address: "",
          neighborhood: "",
          reference: "",
          method: "N/A",
        },
        items: resumoConta.itens.map((item) => ({
          name: item.item,
          orderQuantity: item.quantidade,
          price: isNaN(parseFloat(item.precoUnitario))
            ? 0
            : parseFloat(item.precoUnitario),
        })),
        total: isNaN(parseFloat(resumoConta.total))
          ? 0
          : parseFloat(resumoConta.total),
        createdAt: new Date(),
        status: "Pendente",
      };

      console.log(
        "(NOBRIDGE) LOG Iniciando impressão da comanda - Order:",
        JSON.stringify(order, null, 2)
      );
      await printOrder(order);

      Alert.alert("Sucesso", "Comanda impressa com sucesso!");
    } catch (error) {
      console.error("(NOBRIDGE) ERROR Erro ao imprimir comanda:", error);
      Alert.alert(
        "Erro",
        `Não foi possível imprimir a comanda: ${error.message}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const CustomButton = ({ title, onPress, color, disabled }) => (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: disabled ? "#999" : color || "#5C4329" },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.titulo}>
              Fechar Comanda - {mesa?.nomeCliente || "Cliente"}
            </Text>
            <Text style={styles.totalGeral}>
              Total R$ {calcularTotalSemDesconto()}
            </Text>
            <Text style={styles.label}>Desconto:</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite o desconto (ex.: 10.00)"
              keyboardType="numeric"
              value={desconto}
              onChangeText={(text) => setDesconto(text.replace(/[^0-9.]/g, ""))}
              placeholderTextColor="#888"
            />
            <Text style={styles.totalGeral}>
              Total com desconto: R$ {calcularTotalComDesconto()}
            </Text>
            <Text style={styles.label}>Dividir em quantas partes?</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex.: 1"
              keyboardType="numeric"
              value={divisao}
              onChangeText={(text) => setDivisao(text.replace(/[^0-9]/g, ""))}
              placeholderTextColor="#888"
            />
            <Text style={styles.divisao}>
              Valor por parte: R$ {calcularDivisao()}
            </Text>
            <Text style={styles.label}>Pagar parcial:</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite o valor pago (ex.: 15.00)"
              keyboardType="numeric"
              value={valorPago}
              onChangeText={(text) =>
                setValorPago(text.replace(/[^0-9.]/g, ""))
              }
              placeholderTextColor="#888"
            />
            <Text style={styles.label}>Valor Recebido:</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite o valor recebido (ex.: 50.00)"
              keyboardType="numeric"
              value={valorRecebido}
              onChangeText={(text) =>
                setValorRecebido(text.replace(/[^0-9.]/g, ""))
              }
              placeholderTextColor="#888"
            />

            {!isPagamentoSuficiente() && isPagamentoParcial() && (
              <Text style={styles.saldoDevedor}>
                Saldo Devedor: R$ {calcularRestante()}
              </Text>
            )}
            <Text
              style={[
                styles.troco,
                isPagamentoSuficiente() && styles.trocoDestaque,
              ]}
            >
              Troco: R$ {calcularTroco()}
            </Text>
            <Text style={styles.label}>Número do Cliente:</Text>
            <TextInput
              style={styles.input}
              placeholder="Número do Cliente (ex.: 11987654321)"
              keyboardType="phone-pad"
              value={telefoneCliente}
              onChangeText={setTelefoneCliente}
              placeholderTextColor="#888"
            />
            <View style={styles.botoes}>
              <CustomButton
                title="Enviar via WhatsApp"
                onPress={handleEnviarWhatsApp}
                color="#25D366"
                disabled={!isPagamentoSuficiente() || isSubmitting}
              />
              <CustomButton
                title="Imprimir Comanda"
                onPress={handleImprimirComanda}
                color="#007BFF"
                disabled={isSubmitting}
              />
              <CustomButton
                title="Fechar Comanda"
                onPress={handleFecharComanda}
                color="#ff4444"
                disabled={!isPagamentoSuficiente() || isSubmitting}
              />
              {isPagamentoParcial() && (
                <CustomButton
                  title="Recebido Parcial"
                  onPress={handleRecebidoParcial}
                  color="#FFA500"
                  disabled={isSubmitting}
                />
              )}
              <CustomButton title="Voltar" onPress={onClose} color="#666" />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalContent: {
    width: "90%",
    maxWidth: 400,
    borderRadius: 15,
    backgroundColor: "#5C4329",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  titulo: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFA500",
    textAlign: "center",
    marginBottom: 20,
  },
  totalGeral: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginVertical: 15,
  },
  label: {
    fontSize: 16,
    color: "#999",
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    marginVertical: 10,
    fontSize: 16,
    color: "#FFFFFF",
    backgroundColor: "#FFFFFF00",
    textAlign: "left",
  },
  divisao: {
    fontSize: 16,
    color: "#FFA500",
    textAlign: "center",
    marginVertical: 10,
  },
  restante: {
    fontSize: 16,
    color: "#FFA500",
    textAlign: "center",
    marginVertical: 10,
  },
  saldoDevedor: {
    fontSize: 16,
    color: "#FF4444",
    textAlign: "center",
    marginVertical: 10,
    fontWeight: "600",
  },
  troco: {
    fontSize: 16,
    color: "#FFFFFF",
    textAlign: "center",
    marginVertical: 15,
  },
  trocoDestaque: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#28A745",
  },
  botoes: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 20,
    gap: 15,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#5C4329",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  buttonText: {
    color: "#F9D423",
    fontSize: 16,
    fontWeight: "600",
  },
});
