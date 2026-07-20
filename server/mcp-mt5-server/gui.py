import customtkinter as ctk
import threading
import sys
import os
from PIL import Image

# Setup custom theme
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("dark-blue")

# Gold accent hex
GOLD = "#D4AF37"
DARK_BG = "#121212"
PANEL_BG = "#1E1E1E"

def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(os.path.dirname(__file__))
    return os.path.join(base_path, relative_path)

class PrintRedirector:
    def __init__(self, log_callback):
        self.log_callback = log_callback

    def write(self, message):
        if message.strip():
            self.log_callback(message.strip())

    def flush(self):
        pass

class App(ctk.CTk):
    def __init__(self, start_async_loop_callback):
        super().__init__()

        self.title("Hunter Trades AI Trading")
        self.geometry("650x550")
        self.configure(fg_color=DARK_BG)
        
        try:
            self.iconbitmap(resource_path("logo.ico"))
        except:
            pass

        # Configure grid
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # Header Frame
        self.header_frame = ctk.CTkFrame(self, fg_color=PANEL_BG, corner_radius=0)
        self.header_frame.grid(row=0, column=0, sticky="ew")
        
        # Try load logo image
        self.logo_image = None
        try:
            logo_img = Image.open(resource_path("logo.png"))
            self.logo_image = ctk.CTkImage(logo_img, size=(45, 45))
        except:
            pass
            
        self.logo_label = ctk.CTkLabel(
            self.header_frame, 
            text=" HUNTER TRADES AI", 
            image=self.logo_image,
            compound="left",
            font=ctk.CTkFont(family="Arial", size=20, weight="bold"),
            text_color=GOLD
        )
        self.logo_label.pack(pady=15, padx=20, side="left")
        
        self.status_indicator = ctk.CTkLabel(
            self.header_frame,
            text="● Disconnected",
            text_color="red",
            font=ctk.CTkFont(size=14, weight="bold")
        )
        self.status_indicator.pack(pady=15, padx=20, side="right")

        # Log Frame
        self.log_textbox = ctk.CTkTextbox(
            self, 
            fg_color="#0A0A0A", 
            text_color="#AAAAAA",
            font=ctk.CTkFont(family="Consolas", size=12)
        )
        self.log_textbox.grid(row=1, column=0, sticky="nsew", padx=20, pady=(20, 0))
        self.log_textbox.configure(state="disabled")

        # Footer Frame
        self.footer_frame = ctk.CTkFrame(self, fg_color=DARK_BG)
        self.footer_frame.grid(row=2, column=0, sticky="ew", padx=20, pady=20)
        
        self.footer_frame.grid_columnconfigure(0, weight=1)
        self.footer_frame.grid_columnconfigure(1, weight=1)

        self.start_btn = ctk.CTkButton(
            self.footer_frame, 
            text="Connect to Railway", 
            fg_color=GOLD, 
            text_color="black",
            hover_color="#B5952F",
            font=ctk.CTkFont(weight="bold"),
            command=self.start_btn_clicked
        )
        self.start_btn.grid(row=0, column=0, padx=5, sticky="ew")

        self.stop_btn = ctk.CTkButton(
            self.footer_frame, 
            text="Exit", 
            fg_color="#333333",
            hover_color="#444444",
            command=self.destroy
        )
        self.stop_btn.grid(row=0, column=1, padx=5, sticky="ew")

        self.start_async_loop_callback = start_async_loop_callback
        self.is_running = False
        
        self.log("========================================")
        self.log(" Hunter Trades AI Trading Client")
        self.log("========================================")
        self.log("Ready. Click 'Connect to Railway' to start.")

        # Redirect stdout and stderr to GUI
        sys.stdout = PrintRedirector(self.log)
        sys.stderr = PrintRedirector(self.log)

    def log(self, message):
        def _append():
            self.log_textbox.configure(state="normal")
            self.log_textbox.insert("end", message + "\n")
            self.log_textbox.see("end")
            self.log_textbox.configure(state="disabled")
        # Ensure we update GUI from the main thread
        self.after(0, _append)
        
    def set_status(self, connected: bool):
        def _update():
            if connected:
                self.status_indicator.configure(text="● Connected", text_color="#00FF00")
                self.start_btn.configure(state="disabled", fg_color="#333333")
            else:
                self.status_indicator.configure(text="● Disconnected", text_color="red")
                self.start_btn.configure(state="normal", fg_color=GOLD)
        self.after(0, _update)

    def start_btn_clicked(self):
        if not self.is_running:
            self.is_running = True
            self.log("> Starting connection process...")
            self.start_btn.configure(state="disabled")
            
            # Run the callback in a separate thread so GUI doesn't freeze
            threading.Thread(target=self.start_async_loop_callback, args=(self,), daemon=True).start()

def launch_gui(start_async_loop_callback):
    app = App(start_async_loop_callback)
    app.mainloop()
