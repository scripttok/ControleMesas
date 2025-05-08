import React, { useState, useEffect, useCallback, memo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { collection, addDoc } from "firebase/firestore";
import { ref, get, update } from "firebase/database";
import { waitForFirebaseInit, db, database } from "../services/firebase";
import { printOrder } from "../services/printerService";
import Icon from "react-native-vector-icons/MaterialIcons";

// Memoizar TextInput com comparação de props otimizada
const MemoizedTextInput = memo(
  ({
    style,
    placeholder,
    value,
    onChangeText,
    placeholderTextColor,
    keyboardType,
    returnKeyType,
    onSubmitEditing,
  }) => (
    <TextInput
      style={style}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      placeholderTextColor={placeholderTextColor}
      keyboardType={keyboardType}
      blurOnSubmit={false}
      autoCorrect={false}
      autoCapitalize="none"
      returnKeyType={returnKeyType}
      onSubmitEditing={onSubmitEditing}
    />
  ),
  (prevProps, nextProps) => {
    return (
      prevProps.value === nextProps.value &&
      prevProps.placeholder === nextProps.placeholder &&
      prevProps.keyboardType === nextProps.keyboardType &&
      prevProps.onChangeText === nextProps.onChangeText &&
      prevProps.returnKeyType === nextProps.returnKeyType &&
      prevProps.onSubmitEditing === nextProps.onSubmitEditing
    );
  }
);

const DeliveryScreen = () => {
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
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

  // Callbacks estabilizados para atualizar clientData
  const updateClientName = useCallback((text) => {
    setClientData((prev) => ({ ...prev, name: text }));
  }, []);

  const updateClientPhone = useCallback((text) => {
    setClientData((prev) => ({ ...prev, phone: text }));
  }, []);

  const updateClientCpf = useCallback((text) => {
    setClientData((prev) => ({ ...prev, cpf: text }));
  }, []);

  // Callbacks estabilizados para atualizar deliveryData
  const updateDeliveryAddress = useCallback((text) => {
    setDeliveryData((prev) => ({ ...prev, address: text }));
  }, []);

  const updateDeliveryNeighborhood = useCallback((text) => {
    setDeliveryData((prev) => ({ ...prev, neighborhood: text }));
  }, []);

  const updateDeliveryReference = useCallback((text) => {
    setDeliveryData((prev) => ({ ...prev, reference: text }));
  }, []);

  useEffect(() => {
    const fetchStock = async () => {
      setLoading(true);
      setError("");
      try {
        console.log("Aguardando inicialização do Firebase...");
        await waitForFirebaseInit();
        console.log("Firebase inicializado, iniciando fetchStock...");

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
          setFilteredItems([]);
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
                item.estoqueMinimo !== undefined ? item.estoqueMinimo : 0,
              unidade: item.unidade,
            };
          })
          .filter(
            (item) => item.price !== undefined && item.quantity !== undefined
          );
        setItems(stockList);
        setFilteredItems(stockList);
      } catch (error) {
        console.error("Erro ao carregar estoque:", error);
        setError("Não foi possível carregar o estoque: " + error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStock();
  }, []);

  const handleSearch = useCallback(
    (query) => {
      setSearchQuery(query);
      if (query.trim() === "") {
        setFilteredItems(items);
      } else {
        const filtered = items.filter((item) =>
          item.name.toLowerCase().includes(query.toLowerCase())
        );
        setFilteredItems(filtered);
      }
    },
    [items]
  );

  const addItemToOrder = useCallback(
    (item) => {
      if (item.quantity <= 0) {
        setError("Item fora de estoque.");
        return;
      }
      const existingItem = selectedItems.find(
        (selected) => selected.id === item.id
      );
      if (existingItem) {
        setError("Item já adicionado. Altere a quantidade na lista abaixo.");
        return;
      }
      setSelectedItems([...selectedItems, { ...item, orderQuantity: 1 }]);
      setError("");
    },
    [selectedItems]
  );

  const updateItemQuantity = useCallback(
    (itemId, newQuantity) => {
      const quantity = parseInt(newQuantity, 10);
      if (isNaN(quantity) || quantity < 1) {
        setError("Quantidade deve ser um número maior que 0.");
        return;
      }

      const item = items.find((i) => i.id === itemId);
      if (!item) {
        setError("Item não encontrado no estoque.");
        return;
      }

      if (quantity > item.quantity) {
        setError(
          `Quantidade solicitada (${quantity}) excede o estoque disponível (${item.quantity}).`
        );
        return;
      }

      setSelectedItems(
        selectedItems.map((selected) =>
          selected.id === itemId
            ? { ...selected, orderQuantity: quantity }
            : selected
        )
      );
      setError("");
    },
    [items, selectedItems]
  );

  const incrementQuantity = useCallback(
    (itemId) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) {
        setError("Item não encontrado no estoque.");
        return;
      }

      setSelectedItems(
        selectedItems.map((selected) => {
          if (selected.id === itemId) {
            const newQuantity = selected.orderQuantity + 1;
            if (newQuantity > item.quantity) {
              setError(
                `Quantidade solicitada (${newQuantity}) excede o estoque disponível (${item.quantity}).`
              );
              return selected;
            }
            return { ...selected, orderQuantity: newQuantity };
          }
          return selected;
        })
      );
      setError("");
    },
    [items, selectedItems]
  );

  const decrementQuantity = useCallback(
    (itemId) => {
      setSelectedItems(
        selectedItems.map((selected) => {
          if (selected.id === itemId) {
            const newQuantity = selected.orderQuantity - 1;
            if (newQuantity < 1) {
              setError("Quantidade deve ser pelo menos 1.");
              return selected;
            }
            return { ...selected, orderQuantity: newQuantity };
          }
          return selected;
        })
      );
      setError("");
    },
    [selectedItems]
  );

  const removeItem = useCallback(
    (itemId) => {
      setSelectedItems(selectedItems.filter((item) => item.id !== itemId));
      setError("");
    },
    [selectedItems]
  );

  const confirmOrder = useCallback(async () => {
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
      const orderRef = await addDoc(collection(db, "delivery_orders"), order);
      console.log("Pedido salvo com ID:", orderRef.id);

      for (const item of selectedItems) {
        const itemRef = ref(database, `estoque/${item.id}`);
        console.log(
          `Tentando atualizar estoque para item ${item.id}: ${item.quantity} - ${item.orderQuantity}`
        );
        try {
          const itemSnapshot = await get(itemRef);
          if (!itemSnapshot.exists()) {
            throw new Error(`Item ${item.id} não encontrado no estoque.`);
          }
          const currentQuantity = itemSnapshot.val().quantidade;
          const newQuantity = currentQuantity - item.orderQuantity;
          if (newQuantity < 0) {
            throw new Error(`Estoque insuficiente para item ${item.id}.`);
          }
          await update(itemRef, {
            quantidade: newQuantity,
          });
          console.log(
            `Estoque atualizado para item ${item.id}: ${newQuantity}`
          );
        } catch (updateError) {
          console.error(`Erro ao atualizar item ${item.id}:`, updateError);
          throw updateError;
        }
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
      setSearchQuery("");
      setFilteredItems(items);
      setError("");
    } catch (error) {
      console.error("Erro ao confirmar pedido:", error);
      setError("Não foi possível processar o pedido: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [clientData, deliveryData, selectedItems, items]);

  const renderItem = ({ item }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemText} numberOfLines={2} ellipsizeMode="tail">
          {item.name}
        </Text>
        <Text style={styles.itemSubText}>
          R${item.price?.toFixed(2) || "N/A"} | Estoque: {item.quantity || 0}
        </Text>
        <Text style={styles.itemCategory}>
          Categoria: {item.categoria || "N/A"}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => addItemToOrder(item)}
      >
        <Icon name="add-circle" size={28} color="#FFF" />
        <Text style={styles.addButtonText}>Adicionar</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSelectedItem = ({ item, index }) => (
    <View key={`${item.id}-${index}`} style={styles.selectedItemCard}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemText} numberOfLines={2} ellipsizeMode="tail">
          {item.name}
        </Text>
        <Text style={styles.itemSubText}>
          R${(item.price * item.orderQuantity).toFixed(2)}
        </Text>
      </View>
      <View style={styles.quantityContainer}>
        <Text style={styles.quantityLabel}>Qtd:</Text>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => decrementQuantity(item.id)}
        >
          <Icon name="remove" size={20} color="#FFF" />
        </TouchableOpacity>
        <MemoizedTextInput
          style={styles.quantityInput}
          keyboardType="numeric"
          value={item.orderQuantity.toString()}
          onChangeText={(text) => updateItemQuantity(item.id, text)}
          placeholderTextColor="#888"
          returnKeyType="done"
          onSubmitEditing={() => {}}
        />
        <TouchableOpacity
          style={[styles.quantityButton, styles.incrementButton]}
          onPress={() => incrementQuantity(item.id)}
        >
          <Icon name="add" size={20} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeItem(item.id)}
        >
          <Icon name="delete" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHeader = useCallback(
    () => (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="shopping-cart" size={24} color="#FF6F00" />
          <Text style={styles.sectionTitle}>Itens do Pedido</Text>
        </View>
        <View style={styles.searchContainer}>
          <Icon
            name="search"
            size={20}
            color="#888"
            style={styles.searchIcon}
          />
          <MemoizedTextInput
            style={styles.searchInput}
            placeholder="Buscar item por nome"
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor="#888"
            returnKeyType="search"
            onSubmitEditing={() => {}}
          />
        </View>
        {filteredItems.length === 0 && !loading && !error ? (
          <Text style={styles.infoText}>
            {searchQuery
              ? "Nenhum item encontrado para a busca."
              : "Nenhum item disponível no estoque."}
          </Text>
        ) : null}
      </View>
    ),
    [searchQuery, filteredItems, error, loading, handleSearch]
  );

  const renderFooter = useCallback(
    () => (
      <>
        {selectedItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="check-circle" size={24} color="#FF6F00" />
              <Text style={styles.sectionTitle}>Itens Selecionados</Text>
            </View>
            <ScrollView style={styles.list} nestedScrollEnabled={true}>
              {selectedItems.map((item, index) =>
                renderSelectedItem({ item, index })
              )}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity
          style={[styles.confirmButton, loading && styles.disabledButton]}
          onPress={confirmOrder}
          disabled={loading}
        >
          <Text style={styles.confirmButtonText}>
            {loading ? "Confirmando..." : "Confirmar Pedido"}
          </Text>
          <Icon name="send" size={20} color="#FFF" style={styles.buttonIcon} />
        </TouchableOpacity>
      </>
    ),
    [selectedItems, loading, confirmOrder]
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
    >
      <Text style={styles.title}>Novo Pedido Delivery</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading && (
        <ActivityIndicator size="large" color="#FF6F00" style={styles.loader} />
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="person" size={24} color="#FF6F00" />
          <Text style={styles.sectionTitle}>Dados do Cliente</Text>
        </View>
        <MemoizedTextInput
          style={styles.input}
          placeholder="Nome"
          value={clientData.name}
          onChangeText={updateClientName}
          placeholderTextColor="#888"
          returnKeyType="next"
          onSubmitEditing={() => {}}
        />
        <MemoizedTextInput
          style={styles.input}
          placeholder="Telefone"
          value={clientData.phone}
          onChangeText={updateClientPhone}
          placeholderTextColor="#888"
          keyboardType="phone-pad"
          returnKeyType="next"
          onSubmitEditing={() => {}}
        />
        <MemoizedTextInput
          style={styles.input}
          placeholder="CPF (opcional)"
          value={clientData.cpf}
          onChangeText={updateClientCpf}
          placeholderTextColor="#888"
          keyboardType="numeric"
          returnKeyType="done"
          onSubmitEditing={() => {}}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="location-on" size={24} color="#FF6F00" />
          <Text style={styles.sectionTitle}>Dados de Entrega</Text>
        </View>
        <MemoizedTextInput
          style={styles.input}
          placeholder="Endereço"
          value={deliveryData.address}
          onChangeText={updateDeliveryAddress}
          placeholderTextColor="#888"
          returnKeyType="next"
          onSubmitEditing={() => {}}
        />
        <MemoizedTextInput
          style={styles.input}
          placeholder="Bairro"
          value={deliveryData.neighborhood}
          onChangeText={updateDeliveryNeighborhood}
          placeholderTextColor="#888"
          returnKeyType="next"
          onSubmitEditing={() => {}}
        />
        <MemoizedTextInput
          style={styles.input}
          placeholder="Ponto de Referência"
          value={deliveryData.reference}
          onChangeText={updateDeliveryReference}
          placeholderTextColor="#888"
          returnKeyType="done"
          onSubmitEditing={() => {}}
        />
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        extraData={selectedItems}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
    color: "#FF6F00",
  },
  section: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginLeft: 8,
  },
  input: {
    width: "100%",
    height: 48,
    borderColor: "#DDD",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: "#FAFAFA",
    color: "#333",
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DDD",
    marginBottom: 12,
  },
  searchIcon: {
    marginLeft: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 8,
    fontSize: 16,
    color: "#333",
  },
  list: {
    flexGrow: 0,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEFEFE",
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  itemInfo: {
    flex: 1,
  },
  itemText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#222",
    marginBottom: 4,
  },
  itemSubText: {
    fontSize: 16,
    color: "#555",
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 14,
    color: "#888",
    fontStyle: "italic",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6F00",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 6,
  },
  selectedItemCard: {
    backgroundColor: "#FEFEFE",
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginRight: 8,
  },
  quantityInput: {
    width: 60,
    height: 40,
    borderColor: "#DDD",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: "#FAFAFA",
    color: "#333",
    fontSize: 16,
    textAlign: "center",
  },
  quantityButton: {
    backgroundColor: "#FF4444",
    padding: 8,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  incrementButton: {
    backgroundColor: "#FF6F00",
  },
  removeButton: {
    backgroundColor: "#FF4444",
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6F00",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: "#FFB580",
    opacity: 0.7,
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFF",
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  errorText: {
    fontSize: 16,
    color: "#FF4444",
    marginBottom: 16,
    textAlign: "center",
    backgroundColor: "#FFE6E6",
    padding: 8,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 12,
    textAlign: "center",
  },
  loader: {
    marginVertical: 16,
  },
});

export default DeliveryScreen;
