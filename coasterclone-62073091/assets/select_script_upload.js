// declare anonymous scope with dependencies: jQuery, Shopify, window
(function($, Shopify, window) {
  // globals
  // cropped dimensions
  var DIAMETER = 640;
  var PREVIEW_DIAMETER = Math.min(screen.width-20, 400);

  // photo-upload, set of 4 variant = 7432867779;
  // pair clone variant = 10425593923;

  var PRODUCT_VARIANT = document.getElementById("variant-id").value;
  var SET_SIZE = 4;

  // if Photo Pair, reset to 2 coasters
    if (PRODUCT_VARIANT == 10425593923){
    var SET_SIZE = 2;

    //remove last 2 li from shortlist
    $("li.2").hide();
    $("li.3").hide();
    $("div#shortlist_container ul").width("525");
    $("span#price").html("$30");
    }

  // setup event handlers, controller scope
  $(document).ready(function() {

    var images = [];
    var tray = [];

    // rectify for image
    $("#crop-view > img").attr("width", PREVIEW_DIAMETER).attr("height", PREVIEW_DIAMETER);

    $("#choose-photo").on("click", function(e) { $("#file-input").val("").click(); $(this).removeClass('start');});
    $("#file-input").change(function(e) {
      $(".internal-container").show();
      $(".loading").show();
      var resolve = this.files.length;
      var addImage = function(img) {
        tray.push(img);
        if(images.length < SET_SIZE) {
          images.unshift(img);
        }
        if(--resolve === 0) {
          // only render once all files have been read (resolved)
          renderTray(tray, images);
          renderShortlist(images);
          $(".loading").hide();
        }
      };
      for(var i = 0, len = this.files.length; i < len; i++) {
        readImage(this.files[i], addImage);
      }
    });

    $("#save-crop").click(function(e) {
      var $img = $("#crop-view > img");
      var cropdata = $img.cropper("getData", true);
      var img = images[$img.data("index")];
      img.x = cropdata.x;
      img.y = cropdata.y;
      img.w = cropdata.width;
      img.h = cropdata.height;
      renderShortlist(images);
      $("#overlay").hide();
    });

    $("#cancel-crop").click(function(e) { $("#overlay").hide(); });

    $("#shortlist").on("click", "a.crop", function (e) {
      e.preventDefault();
      var index = $(this).parent().data("index");
      var img = images[index];
      $("#overlay").show();

      // detect small screens and adjust for compact layout
      if($("#overlay").width() == screen.width) {
        scrollTo(0,0);
      }

      // setup the cropper after the UI has updated (to prevent rendering problems)
      setTimeout(function() {
        // reset cropper and slider
        var $cropview = $("#crop-view > img");
        $cropview.cropper("destroy");
        $cropview.data("index", index).attr("src", img.url);
        $cropview.cropper({
          aspectRatio: 1,
          autoCropArea: 1,
          wheelZoomRatio: 0.01,
          scalable: false,
          guides: false,
          highlight: false,
          center: false,
          background: false,
          dragCrop: false,
          cropBoxMovable: false,
          cropBoxResizable: false,
          built: function() {
            $cropview.cropper("zoom", Math.max(0, (Math.max(img.naturalWidth, img.naturalHeight) / Math.min(img.naturalWidth, img.naturalHeight)) - 1));
            $cropview.cropper("setCropBoxData", { "left": 0, "top": 0, "width": PREVIEW_DIAMETER, "height": PREVIEW_DIAMETER });
          }
        });

        var slider = document.getElementById("crop-slider");
        var SLIDER_MAX = $cropview.cropper("getCropBoxData").width / DIAMETER * Math.max(img.width, img.height);
        
        if (SLIDER_MAX > PREVIEW_DIAMETER){
          console.log("yes slider");
          $('span.slider_msg').show();

            if(slider.noUiSlider) { slider.noUiSlider.destroy(); }
            noUiSlider.create(slider, {
              "start": PREVIEW_DIAMETER,
              "range": { "min": PREVIEW_DIAMETER, "max": SLIDER_MAX }
            });
            slider.noUiSlider.on("set", function(vals){
              var val = Number(vals[0]);
              console.log(val, typeof val);
              $("#crop-view > img").cropper("setCanvasData", { "left": 0, "top": 0, "width": 0+val, "height": 0+val});
              console.log($("#crop-view > img").cropper("getCanvasData"));
            });

        } else {
          console.log("no slider");
          if(slider.noUiSlider) { slider.noUiSlider.destroy(); }
          $('span.slider_msg').hide();
        }

        
      }, 0);
    });

    $("#shortlist").on("click", "a.remove-link", function (e) {
      e.preventDefault();
      images.splice($(this).parent().data("index"),1);
      renderShortlist(images);
      renderTray(tray, images);
    });

    $("#images").on("click", "li.tray", function(e) {
      e.preventDefault();
      var index = $(this).data("index");
      var img = tray[index];
      if(images.length < SET_SIZE) {
        images.unshift(img);
        renderShortlist(images);
        renderTray(tray, images);
      }
    });

    $("a#add-to-cart").on("click", function (e) {
        e.preventDefault();
        Shopify.addItem(PRODUCT_VARIANT, 1, images);
        $(this).hide();
        $("a#add-coasters").hide();
        $('h1.loader').show();
        pulsate();
    });

    var ADD_COASTERS = 0;
    $("a#add-coasters").on("click", function (e) {
        e.preventDefault();
        SET_SIZE = 4;
        ADD_COASTERS = 1;

        //remove last 2 li from shortlist
        $("div#shortlist_container ul").width("1031");
        $("li.2").fadeIn();
        $("li.3").fadeIn();
        $("#add-to-cart").fadeOut();
        $("#add-coasters").fadeOut();
        $("span#price").html("$49");
        PRODUCT_VARIANT = 7432867779;
    });

    // initial render
    renderShortlist(images);
    renderTray(tray, images);
    $("#file-input").click();
  });

  // Shopify hooks
  Shopify.addItem = function (product_variant, quantity, images) {
    var formdata = new FormData();
    formdata.append("id", product_variant);
    formdata.append("quantity", quantity);
    images.forEach(function(img, i) {
      formdata.append("properties[_img_" + (i+1) + "_url]", img.cropped, "crop_" + img.name);
      formdata.append("properties[_img_" + (i+1) + "_thumbnail]", img.thumbnail, "thumb_" + img.name);
    });

    var xhr = new XMLHttpRequest();
    xhr.addEventListener("load", function(e) { console.log("load", e); loadCart(); }, false);
    xhr.addEventListener("error", function(e) { console.log("error", e); Shopify.onError(xhr, "failed"); }, false);
    xhr.addEventListener("abort", function(e) { console.log("abort", e); Shopify.onError(xhr, "aborted"); }, false);
    xhr.open("POST", "/cart/add");
    xhr.send(formdata);
  };

  // Controllers:

  //loading cart animation
  function pulsate() {
      $(".pulsate").
        animate({opacity: 0.2}, 1500, 'linear').
        animate({opacity: 1}, 1500, 'linear').delay(500, pulsate);
    }

  function readImage(file, callback) {
    var reader = new FileReader();
    reader.onload = function (event) {
      var dataURL = event.target.result;

      // helper functions
      function wrap_callback(data) { data.name = file.name; callback(data); }
      function resize(data) { resizeImage(data.url, 4*DIAMETER, 4*DIAMETER, "cover", wrap_callback); }
      function mirror(data) { mirrorImage(data.url, resize); }

      // check and correct orientation
      getOrientation(file, function(orientation) {
        if(orientation == 1) {
          resize({ "url": dataURL });
        } else if(orientation == 8) {
          rotateImage(dataURL, -1, resize);
        } else if (orientation == 6) {
          rotateImage(dataURL, 1, resize);
        } else if (orientation == 3) {
          rotateImage(dataURL, 2, resize);
        } else if(orientation == 2) {
          mirror({ "url": dataURL });
        } else if (orientation == 7) {
          rotateImage(dataURL, -1, mirror);
        } else if (orientation == 4) {
          rotateImage(dataURL, 2, mirror);
        } else if (orientation == 5) {
          rotateImage(dataURL, 1, mirror);
        } else {
          resize({ "url": dataURL });
        }
      });
    };
    reader.readAsDataURL(file);
  }

  function renderTray(tray, images) {
    $("#images").empty();
    tray.forEach(function(img, i) {
      $('<li data-index="' + i + '">').addClass("tray").toggleClass("shortlisted", images.indexOf(img) > -1).css({
        "background-image": "url(" + img.url + ")",
        "background-size": "cover"
      }).prependTo("#images");
    });
  }

  function renderShortlist(images) {
    // reset
    $("#shortlist li").css("background-image","").addClass("empty").find("a").hide();

    // resize and crop to square
    images.forEach(function(img, i) {
      // thumbWH is the preview thumbnail size
      var thumbWH = 230;
      squarifyImage(img, thumbWH, function(squarified) {
        // render the image preview
        img.thumbnail = dataURLtoBlob(squarified.url);
        $("#shortlist li." + i).removeClass("empty").data("index", i)
        .css("background-image", "url(" + squarified.url + ")").find("a").show();
      });

      // process image (inclusive of user-cropped data), resize and crop based on max dimension
      squarifyImage(img, DIAMETER, function(squarified) {
        img.cropped = dataURLtoBlob(squarified.url);
      });
    });

    // conditional rendering stuff
    var message = "Select <span>" + (SET_SIZE - images.length) + "</span> Images";
    var midSelection = images.length > 0 && images.length < SET_SIZE;
    $("#msg-border").toggle(images.length === 0);
    $("h1#select-image-count").html(message).toggleClass("select-image-count-mid-selection", midSelection).toggle(images.length < SET_SIZE);
    if(images.length == SET_SIZE) {
      $("#add-to-cart").fadeIn();

      if(SET_SIZE == 2){
        $("#add-coasters").fadeIn();
      }
    } else {
      $("#add-to-cart").fadeOut();
      $("#add-coasters").fadeOut();
    }
  }

  // Utility to squarify and apply user-defined cropping
  function squarifyImage(img, wh, callback) {
    var cX = Math.round(img.x !== undefined ? img.x : Math.max(0, (img.width - img.height) / 2));
    var cY = Math.round(img.y !== undefined ? img.y : Math.max(0, (img.height - img.width) / 2));
    var cW = Math.round(img.w !== undefined ? img.w : Math.min(img.width, img.height));
    var cH = Math.round(img.h !== undefined ? img.h : Math.min(img.width, img.height));
    cropImage(img.url, cX, cY, cW, cH, function(cropped) {
      resizeImage(cropped.url, wh, wh, "cover", callback);
    });
  }

  function loadCart(){
    window.location = document.getElementById("shop-url").innerHTML + "/cart";
  }

  // Image manipulation functions
  // Utility to create a canvas element
  function newCanvasContext(w,h) {
    var canvas = document.createElement("CANVAS");
    canvas.width = w;
    canvas.height = h;
    return canvas.getContext("2d");
  }

  // Downsamples the input such that the result will either "cover" or "contain" the desired width / height,
  // (either width or height may be larger than desired, but the other dimension will be an exact fit)
  // and returns a JPEG
  function resizeImage(dataURL, w, h, mode, callback) {
    var tmp = new Image();
    tmp.onload = function() {
      var downsample = Math.max(1, Math[mode == "cover" ? "min" : "max"](this.naturalWidth / w, this.naturalHeight / h));
      var cW = Math.round(this.naturalWidth / downsample);
      var cH = Math.round(this.naturalHeight / downsample);
      var c = newCanvasContext(cW, cH);
      c.drawImage(this, 0, 0, cW, cH);
      callback({
        "naturalWidth": this.naturalWidth,
        "naturalHeight": this.naturalHeight,
        "width": cW,
        "height": cH,
        "url": c.canvas.toDataURL("image/jpeg")
      });
    };
    tmp.src = dataURL;
  }

  // rotate by multiples of PI/2 (90 deg)
  function rotateImage(dataURL, dir, callback) {
    var tmp = new Image();
    tmp.onload = function() {
      dir = dir || 1;
      var newW = Math.abs(dir) % 2 == 1 ? this.naturalHeight : this.naturalWidth;
      var newH = Math.abs(dir) % 2 == 1 ? this.naturalWidth : this.naturalHeight;
      var c = newCanvasContext(newW, newH);
      var tx = Math.round(Math.cos(dir*Math.PI/2) > Math.sin(dir*Math.PI/2) ? 0 : newW);
      var ty = Math.round(Math.cos(dir*Math.PI/2) + Math.sin(dir*Math.PI/2) > 0 ? 0 : newH);
      c.translate(tx,ty);
      c.rotate(dir * Math.PI/2);
      c.drawImage(this, 0, 0);
      callback({
        "naturalWidth": this.naturalWidth,
        "naturalHeight": this.naturalHeight,
        "width": newW,
        "height": newH,
        "url": c.canvas.toDataURL("image/jpeg")
      });
    };
    tmp.src = dataURL;
  }

  // mirror along horizontal axis
  function mirrorImage(dataURL, callback) {
    var tmp = new Image();
    tmp.onload = function() {
      var c = module.exports.newCanvasContext(this.naturalWidth, this.naturalHeight);
      canvasContext.translate(this.naturalWidth, 0);
      canvasContext.scale(-1, 1);
      c.drawImage(this, 0, 0);
      callback({
        "naturalWidth": this.naturalWidth,
        "naturalHeight": this.naturalHeight,
        "width": this.width, 
        "height": this.height, 
        "url": c.canvas.toDataURL("image/jpeg")
      });
    };
    tmp.src = dataURL;
  }

  // Crop rectangle defined by (x, y), (x+w, y+h).
  function cropImage(dataURL, x, y, w, h, callback) {
    var tmp = new Image();
    tmp.onload = function() {
      var c = newCanvasContext(w, h);
      c.drawImage(this, x, y, w, h, 0, 0, w, h);
      callback({ "width": w, "height": h, "url": c.canvas.toDataURL("image/jpeg") });
    };
    tmp.src = dataURL;
  }

  // Convert dataURL back to File blob for upload
 function dataURLtoBlob(dataURL) {
    var binary = atob(dataURL.split(',')[1]);
    var array = [];
    for(var i = 0; i < binary.length; i++) {
        array.push(binary.charCodeAt(i));
    }
    return new Blob([new Uint8Array(array)], {"type": "image/jpeg"});
  }

  // http://stackoverflow.com/a/32490603
  function getOrientation(file, callback) {
    var reader = new FileReader();
    reader.onload = function(e) {

      var view = new DataView(e.target.result);
      if (view.getUint16(0, false) != 0xFFD8) return callback(-2);
      var length = view.byteLength;
      var offset = 2;
      while (offset < length) {
        var marker = view.getUint16(offset, false);
        offset += 2;
        if (marker == 0xFFE1) {
          var little = view.getUint16(offset += 8, false) == 0x4949;
          offset += view.getUint32(offset + 4, little);
          var tags = view.getUint16(offset, little);
          offset += 2;
          for (var i = 0; i < tags; i++)
          if (view.getUint16(offset + (i * 12), little) == 0x0112)
            return callback(view.getUint16(offset + (i * 12) + 8, little));
        }
        else if ((marker & 0xFF00) != 0xFF00) break;
        else offset += view.getUint16(offset, false);
      }
      return callback(-1);
    };
    reader.readAsArrayBuffer(file.slice(0, 64 * 1024));
  }
})($, Shopify, window);