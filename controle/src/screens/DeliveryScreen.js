import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { collection, addDoc } from "firebase/firestore";
import { ref, get, update } from "firebase/database";
import { waitForFirebaseInit, db, database } from "../services/firebase";
import { printOrder } from "../services/printerService";

const DeliveryScreen = () => {
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [clientData, setClientData] = useState({
    name: "",
    phone: "",
    cpf: "",
  });
  const [deliveryData, setDeliveryData] = useState({
    address: "",
    neighborhood: "",
    reference: "",
    method: "Motoboy",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStock = async () => {
      setLoading(true);
      setError("");
      try {
        console.log("Aguardando inicialização do Firebase...");
        await waitForFirebaseInit();
        console.log("Firebase inicializado, iniciando fetchStock...");

        // Usar Realtime Database em vez de Firestore
        const stockRef = ref(database, "estoque");
        const stockSnapshot = await get(stockRef);
        console.log(
          "Stock snapshot:",
          stockSnapshot.exists()
            ? "Dados encontrados"
            : "Nenhum dado encontrado"
        );

        if (!stockSnapshot.exists()) {
          setError("Nenhum item encontrado no estoque.");
          setItems([]);
          return;
        }

        const stockData = stockSnapshot.val();
        const stockList = Object.keys(stockData)
          .map((key) => {
            const item = stockData[key];
            console.log("Item:", key, item);
            return {
              id: key,
              name: item.nome,
              price: item.precoUnitario,
              quantity: item.quantidade,
              categoria: item.categoria,
              chaveCardapio: item.chaveCardapio,
              estoqueMinimo:
                item.estoqueMinimo !== undefined ? item.estoqueMinimo : 0, // Definir 0 se undefined
              unidade: item.unidade,
            };
          })
          .filter(
            (item) => item.price !== undefined && item.quantity !== undefined
          );
        setItems(stockList);
      } catch (error) {
        console.error("Erro ao carregar estoque:", error);
        setError("Não foi possível carregar o estoque: " + error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStock();
  }, []);

  const addItemToOrder = (item) => {
    if (item.quantity <= 0) {
      setError("Item fora de estoque.");
      return;
    }
    setSelectedItems([...selectedItems, { ...item, orderQuantity: 1 }]);
    setError("");
  };

  const confirmOrder = async () => {
    if (
      !clientData.name ||
      !deliveryData.address ||
      selectedItems.length === 0
    ) {
      setError("Preencha todos os campos e selecione pelo menos um item.");
      return;
    }

    setLoading(true);
    try {
      console.log(
        "Aguardando inicialização do Firebase para confirmar pedido..."
      );
      await waitForFirebaseInit();
      console.log("Firebase inicializado, confirmando pedido...");

      const order = {
        client: clientData,
        delivery: deliveryData,
        items: selectedItems,
        total: selectedItems.reduce(
          (sum, item) => sum + item.price * item.orderQuantity,
          0
        ),
        createdAt: new Date(),
        status: "Pendente",
      };
      console.log("Salvando pedido:", order);
      await addDoc(collection(db, "delivery_orders"), order);

      // Atualizar estoque no Realtime Database
      for (const item of selectedItems) {
        const itemRef = ref(database, `estoque/${item.id}`);
        console.log(
          `Atualizando estoque para item ${item.id}: ${item.quantity} - ${item.orderQuantity}`
        );
        await update(itemRef, {
          quantidade: item.quantity - item.orderQuantity,
        });
      }

      console.log("Iniciando impressão do pedido...");
      await printOrder({
        ...order,
        title: "Pedido Delivery",
      });

      Alert.alert("Sucesso", "Pedido confirmado e impresso!");
      setSelectedItems([]);
      setClientData({ name: "", phone: "", cpf: "" });
      setDeliveryData({
        address: "",
        neighborhood: "",
        reference: "",
        method: "Motoboy",
      });
      setError("");
    } catch (error) {
      console.error("Erro ao confirmar pedido:", error);
      setError("Não foi possível processar o pedido: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <Text style={styles.itemText}>
        {item.name} - R${item.price?.toFixed(2) || "N/A"} (Estoque:{" "}
        {item.quantity || 0})
      </Text>
      <Button
        title="Adicionar"
        onPress={() => addItemToOrder(item)}
        color="#FFA500"
      />
    </View>
  );

  const renderSelectedItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <Text style={styles.itemText}>
        {item.name} - Quantidade: {item.orderQuantity} - R$
        {(item.price * item.orderQuantity).toFixed(2)}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Novo Pedido Delivery</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading && (
        <ActivityIndicator size="large" color="#FFA500" style={styles.loader} />
      )}

      <Text style={styles.label}>Dados do Cliente</Text>
      <TextInput
        style={styles.input}
        placeholder="Nome"
        value={clientData.name}
        onChangeText={(text) => setClientData({ ...clientData, name: text })}
        placeholderTextColor="#888"
      />
      <TextInput
        style={styles.input}
        placeholder="Telefone"
        value={clientData.phone}
        onChangeText={(text) => setClientData({ ...clientData, phone: text })}
        placeholderTextColor="#888"
      />
      <TextInput
        style={styles.input}
        placeholder="CPF (opcional)"
        value={clientData.cpf}
        onChangeText={(text) => setClientData({ ...clientData, cpf: text })}
        placeholderTextColor="#888"
      />

      <Text style={styles.label}>Dados de Entrega</Text>
      <TextInput
        style={styles.input}
        placeholder="Endereço"
        value={deliveryData.address}
        onChangeText={(text) =>
          setDeliveryData({ ...deliveryData, address: text })
        }
        placeholderTextColor="#888"
      />
      <TextInput
        style={styles.input}
        placeholder="Bairro"
        value={deliveryData.neighborhood}
        onChangeText={(text) =>
          setDeliveryData({ ...deliveryData, neighborhood: text })
        }
        placeholderTextColor="#888"
      />
      <TextInput
        style={styles.input}
        placeholder="Ponto de Referência"
        value={deliveryData.reference}
        onChangeText={(text) =>
          setDeliveryData({ ...deliveryData, reference: text })
        }
        placeholderTextColor="#888"
      />

      <Text style={styles.label}>Itens do Pedido</Text>
      {items.length === 0 && !loading && !error ? (
        <Text style={styles.infoText}>Nenhum item disponível no estoque.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={styles.list}
        />
      )}

      {selectedItems.length > 0 && (
        <View style={styles.selectedItemsContainer}>
          <Text style={styles.label}>Itens Selecionados</Text>
          <FlatList
            data={selectedItems}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            renderItem={renderSelectedItem}
            style={styles.list}
          />
        </View>
      )}

      <Button
        title={loading ? "Confirmando..." : "Confirmar Pedido"}
        onPress={confirmOrder}
        color="#FFA500"
        disabled={loading}
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
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#000",
  },
  input: {
    width: "100%",
    height: 44,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 15,
    backgroundColor: "#F9F9F9",
    color: "#000",
  },
  list: {
    flex: 1,
    marginBottom: 16,
  },
  itemContainer: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  itemText: {
    fontSize: 14,
    color: "#000",
  },
  selectedItemsContainer: {
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: "red",
    marginBottom: 16,
    textAlign: "center",
  },
  infoText: {
    fontSize: 16,
    marginBottom: 8,
    textAlign: "center",
    color: "#000",
  },
  loader: {
    marginVertical: 16,
  },
});

export default DeliveryScreen;
