
/* 'DepthMap' renders depth buffer of the current view into a texture. To be compatible with as
   many devices as possible, this code does not use the WEBGL_depth_texture extension, but
   instead color-codes the depth value into an ordinary RGB8 texture.

   This depth texture can then be used for effects such as outline rendering, screen-space
   ambient occlusion (SSAO) and shadow mapping.
   
*/
render.DepthMap = {


  init: function() {
    this.shader = new glx.Shader({
      vertexShader: Shaders.depth.vertex,
      fragmentShader: Shaders.depth.fragment,
      attributes: ['aPosition'],
      uniforms: ['uMatrix']
    });

    this.framebuffer = new glx.Framebuffer(128, 128); //dummy values, will be resized dynamically

    this.mapPlane = new mesh.MapPlane();
  },

  render: function(framebufferConfig) {

    var
      shader = this.shader,
      framebuffer = this.framebuffer;


    if (framebuffer.width != framebufferConfig.width || 
        framebuffer.height!= framebufferConfig.height)
    {
      framebuffer.setSize( framebufferConfig.width, framebufferConfig.height );

      /* We will be sampling neighboring pixels of the depth texture to create an ambient
       * occlusion map. With the default texture wrap mode 'gl.REPEAT', sampling the neighbors
       * of edge texels would return texels on the opposite edge of the texture, which is not
       * what we want. Setting the wrap mode to 'gl.CLAMP' instead returns the texels themselves,
       * which is far more useful for ambient occlusion maps */
      //FIXME: seems not to have an effect
      
      gl.bindTexture(gl.TEXTURE_2D, this.framebuffer.renderTexture.id);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP);
      
      /* We will explicitly access (neighbor) texel in depth texture to compute the ambient map.
       * So linear interpolation or mip-mapping of texels neither necessary nor desirable.
       * Disabling it can also noticably improve render performance, as it leads to fewer
       * texture lookups (1 for "NEAREST" vs. 4 for "LINEAR" vs. 8 for "LINEAR_MIPMAP_LINEAR");
       */
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
      
    gl.viewport(0, 0, framebufferConfig.usedWidth, framebufferConfig.usedHeight);
    shader.enable();
    framebuffer.enable();

    gl.clearColor(0.0, 0.0, 0.0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var item, modelMatrix;
    
    // render all actual data items, but also a dummy map plane
    var dataItems = data.Index.items.concat([this.mapPlane]);

    for (var i = 0; i < dataItems.length; i++) {
      item = dataItems[i];

      if (MAP.zoom < item.minZoom || MAP.zoom > item.maxZoom) {
        continue;
      }

      if (!(modelMatrix = item.getMatrix())) {
        continue;
      }

      gl.uniformMatrix4fv(shader.uniforms.uMatrix, false, glx.Matrix.multiply(modelMatrix, render.viewProjMatrix));

      item.vertexBuffer.enable();
      gl.vertexAttribPointer(shader.attributes.aPosition, item.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, item.vertexBuffer.numItems);
    }

    shader.disable();
    framebuffer.disable();

    gl.viewport(0, 0, MAP.width, MAP.height);

  },

  destroy: function() {}
};
