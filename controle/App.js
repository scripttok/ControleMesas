import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  View,
  Text,
  Button,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import HomeScreen from "./src/screens/HomeScreen";
import HistoricoPedidosScreen from "./src/screens/HistoricoPedidosScreen";

const Drawer = createDrawerNavigator();

function DrawerContent({ navigation }) {
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [actionToPerform, setActionToPerform] = useState(null);

  const checkPassword = (action) => {
    setActionToPerform(() => action);
    setPasswordModalVisible(true);
  };

  const handlePasswordSubmit = () => {
    if (password === "1249") {
      setPasswordModalVisible(false);
      setPassword("");
      if (actionToPerform) {
        actionToPerform();
      }
    } else {
      Alert.alert("Erro", "Senha incorreta!");
      setPassword("");
    }
  };

  return (
    <View style={styles.drawerContainer}>
      <Text style={styles.drawerTitle}>Menu</Text>
      <View style={{ marginVertical: 10 }}>
        <Button
          title="Adicionar Mesa"
          onPress={() => {
            navigation.navigate("Home", { adicionarMesa: true });
            navigation.closeDrawer();
          }}
          color="#FFA500"
        />
      </View>
      <View style={{ marginVertical: 10 }}>
        <Button
          title="Controle de Estoque"
          onPress={() =>
            checkPassword(() => {
              navigation.navigate("Home", { controleEstoque: true });
              navigation.closeDrawer();
            })
          }
          color="#FFA500"
        />
      </View>
      <View style={{ marginVertical: 10 }}>
        <Button
          title="Gerenciar Estoque/Cardápio"
          onPress={() =>
            checkPassword(() => {
              navigation.navigate("Home", { gerenciarEstoque: true });
              navigation.closeDrawer();
            })
          }
          color="#FFA500"
        />
      </View>
      {/* <View style={{ marginVertical: 10 }}>
        <Button
          title="Gerenciar Fichas Técnicas"
          onPress={() =>
            checkPassword(() => {
              navigation.navigate("Home", { gerenciarFichas: true });
              navigation.closeDrawer();
            })
          }
          color="#FFA500"
        />
      </View> */}
      <View style={{ marginVertical: 10 }}>
        <Button
          title="Histórico"
          onPress={() =>
            checkPassword(() => {
              navigation.navigate("HistoricoPedidos");
              navigation.closeDrawer();
            })
          }
          color="#FFA500"
        />
      </View>

      <Modal
        visible={passwordModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.passwordModal}>
            <Text style={styles.modalTitle}>Digite a Senha</Text>
            <TextInput
              style={styles.passwordInput}
              placeholder="Senha"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholderTextColor="#888"
            />
            <View style={styles.modalButtons}>
              <Button
                title="Confirmar"
                onPress={handlePasswordSubmit}
                color="#FFA500"
              />
              <Button
                title="Cancelar"
                onPress={() => {
                  setPasswordModalVisible(false);
                  setPassword("");
                  setActionToPerform(null);
                }}
                color="#FF4444"
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Drawer.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
          }}
          drawerContent={(props) => <DrawerContent {...props} />}
        >
          <Drawer.Screen name="Home" component={HomeScreen} />
          <Drawer.Screen
            name="HistoricoPedidos"
            component={HistoricoPedidosScreen}
          />
        </Drawer.Navigator>
        <StatusBar style="auto" />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  passwordModal: {
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
  passwordInput: {
    width: "100%",
    height: 40,
    borderColor: "#5C4329",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 20,
    color: "#000",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
});
